import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import db from '../db';
import { generateApiKey, generateId, hashApiKey, validateAppSecret, verifyApiKey } from '../auth';

// Validation Schemas
const OnboardSchema = z.object({
    name: z.string().min(1),
    city: z.string().min(1),
    specialty: z.string().optional(),
});

const BookSchema = z.object({
    clinicId: z.string().uuid(),
    patientName: z.string().min(1),
    phone: z.string().min(10),
    reason: z.string().optional(),
});

const PublishSlotsSchema = z.object({
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
    slots: z.array(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/)
    }))
});

const BookSlotSchema = z.object({
    clinicId: z.string().optional(), // Required if slotId is missing
    slotId: z.string().uuid().optional(),
    patientName: z.string().min(1),
    phone: z.string().min(10),
    reason: z.string().optional(),
});

export default async function apiRoutes(server: FastifyInstance) {

    // 1. Onboard (Public but Guarded)
    server.post('/onboard', async (req, reply) => {
        const appSecret = req.headers['x-app-secret'] as string;
        if (!validateAppSecret(appSecret)) {
            return reply.code(403).send({ error: 'Invalid App Secret' });
        }

        const result = OnboardSchema.safeParse(req.body);
        if (!result.success) {
            return reply.code(400).send({ error: 'Validation Error', details: result.error });
        }
        const body = result.data;
        const id = generateId();
        const apiKey = generateApiKey();
        const hash = hashApiKey(apiKey);

        const stmt = db.prepare('INSERT INTO clinics (id, name, city, specialty, api_key_hash) VALUES (?, ?, ?, ?, ?)');
        stmt.run(id, body.name, body.city, body.specialty || null, hash);

        return { clinicId: id, apiKey };
    });

    // 2. Public Directory (Get Clinics)
    server.get('/clinics', async (req, reply) => {
        const stmt = db.prepare('SELECT id, name, city, specialty, last_seen FROM clinics');
        return stmt.all();
    });

    // 3. Book Appointment (Public)
    server.post('/book', async (req, reply) => {
        const result = BookSlotSchema.safeParse(req.body);

        if (!result.success) {
            return reply.code(400).send({ error: 'Validation Error', details: result.error });
        }
        const body = result.data as any;

        let clinicId: string | undefined = body.clinicId;
        let date: string | null = null;
        let time: string | null = null;

        // Atomic Transaction: Check status -> Hold -> Notify
        const txn = db.transaction(() => {
            if (body.slotId) {
                const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(body.slotId) as any;
                if (!slot) return { error: 'Slot not found', code: 404 };
                if (slot.status !== 'AVAILABLE') return { error: 'Slot already taken', code: 409 };

                // 1. Mark as HELD with expiration
                db.prepare("UPDATE slots SET status = 'HELD', held_until = datetime('now', '+15 minutes') WHERE id = ?").run(body.slotId);
                clinicId = slot.clinic_id;
                date = slot.date;
                time = slot.time;
            } else {
                // General Request: Ensure clinicId is provided
                if (!clinicId) return { error: 'Clinic ID required when no slot selected', code: 400 };
            }

            // 2. Queue Message for Clinic
            const msgId = generateId();
            const payload = JSON.stringify({
                slotId: body.slotId || null,
                date: date,
                time: time,
                name: body.patientName,
                phone: body.phone,
                reason: body.reason
            });

            db.prepare('INSERT INTO messages (id, clinic_id, type, payload) VALUES (?, ?, ?, ?)').run(msgId, clinicId, 'APPOINTMENT_REQUEST', payload);

            return { status: 'queued', messageId: msgId };
        });

        const txnResult = txn();
        if ((txnResult as any).error) {
            return reply.code((txnResult as any).code).send({ error: (txnResult as any).error });
        }

        return txnResult;
    });

    // 4. Get Slots (Public)
    server.get('/slots/:clinicId', async (req, reply) => {
        const { clinicId } = req.params as any;
        const { date } = req.query as any;

        let query = "SELECT id, date, time, status FROM slots WHERE clinic_id = ? AND (status = 'AVAILABLE' OR (status = 'HELD' AND held_until <= datetime('now'))) AND date >= date('now')";
        const params: any[] = [clinicId];

        if (date) {
            query += " AND date = ?";
            params.push(date);
        }

        query += " ORDER BY date, time";
        const stmt = db.prepare(query);
        return stmt.all(...params);
    });

    // --- Authenticated Routes (Requires x-api-key) ---

    server.addHook('preHandler', async (req, reply) => {
        // Skip auth for public routes handled above
        const url = req.url;
        // Strip query params if any
        const path = url.split('?')[0];

        if (
            path === '/onboard' ||
            path === '/book' ||
            path === '/clinics' ||
            path.startsWith('/slots/')
        ) return;
        // Note: Routes are registered without prefix in apiRoutes, but server registers apiRoutes with /api/v1 prefix?
        // Wait, app.ts sets prefix: '/api/v1'. So req.url includes it.
        if (
            path === '/api/v1/onboard' ||
            path === '/api/v1/book' ||
            path === '/api/v1/clinics' ||
            path.startsWith('/api/v1/slots/')
        ) return;

        const apiKey = req.headers['x-api-key'] as string;
        const clinicId = req.headers['x-clinic-id'] as string;

        if (!apiKey || !clinicId) {
            return reply.code(401).send({ error: 'Missing Credentials' });
        }

        const clinic = db.prepare('SELECT api_key_hash FROM clinics WHERE id = ?').get(clinicId) as { api_key_hash: string } | undefined;

        if (!clinic || !verifyApiKey(apiKey, clinic.api_key_hash)) {
            return reply.code(401).send({ error: 'Invalid Credentials' });
        }
    });

    // 4. Sync (Poll)
    server.get('/sync', async (req, reply) => {
        const clinicId = req.headers['x-clinic-id'];
        const stmt = db.prepare('SELECT * FROM messages WHERE clinic_id = ? ORDER BY created_at ASC');
        const messages = stmt.all(clinicId);

        // Auto-update heartbeat
        db.prepare('UPDATE clinics SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(clinicId);

        // Parse JSON payloads for clean response
        return messages.map((m: any) => {
            try {
                return { ...m, payload: JSON.parse(m.payload) };
            } catch (e) {
                return { ...m, payload: null, parseError: true };
            }
        });
    });

    // 6. Ack (Delete)
    server.post('/ack', async (req, reply) => {
        const clinicId = req.headers['x-clinic-id'];
        const body = z.object({ ids: z.array(z.string()) }).parse(req.body);

        if (body.ids.length > 0) {
            const placeholders = body.ids.map(() => '?').join(',');
            const stmt = db.prepare(`DELETE FROM messages WHERE clinic_id = ? AND id IN (${placeholders})`);
            stmt.run(clinicId, ...body.ids);
        }

        return { status: 'ok' };
    });

    // 7. Publish Slots (Authenticated)
    // Redundant schema removed. Using top-level PublishSlotsSchema.

    // ... inside apiRoutes function ...

    // 7. Publish Slots (Authenticated)
    server.post('/slots', async (req, reply) => {
        const clinicId = req.headers['x-clinic-id'];
        const body = PublishSlotsSchema.parse(req.body);

        // Transaction
        const txn = db.transaction(() => {
            const stmt = db.prepare('INSERT INTO slots (id, clinic_id, date, time) VALUES (?, ?, ?, ?)');

            // 1. Explicitly clear slots for the target dates
            // This ensures that if body.slots is empty for a date, that date is still cleared.
            const dates = body.dates;
            if (dates.length > 0) {
                const placeholders = dates.map(() => '?').join(',');
                const resultDelete = db.prepare(`DELETE FROM slots WHERE clinic_id = ? AND status = 'AVAILABLE' AND date IN (${placeholders})`);
                resultDelete.run(clinicId, ...dates);
            }

            // 2. Insert new slots
            let count = 0;
            for (const slot of body.slots) {
                if (dates.includes(slot.date)) {
                    stmt.run(generateId(), clinicId, slot.date, slot.time);
                    count++;
                }
            }
            return { status: 'ok', count };
        });

        const txnResult = txn();
        return txnResult;
    });
}

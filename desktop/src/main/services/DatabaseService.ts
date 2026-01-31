import { MIGRATIONS } from '../schema/migrations';

export class DatabaseService {
    private db: any;

    setDb(db: any) {
        this.db = db;
    }

    async migrate() {
        if (!this.db) throw new Error('DB not initialized');

        // Safety: Backup before migrating
        try {
            const dbName = this.db.name;
            if (dbName && dbName !== ':memory:') {
                if (dbName && dbName !== ':memory:') {
                    const backupName = `${dbName}.bak`;
                    // Delete existing backup to prevent "incompatible source and target" errors 
                    // if the schema/key changed since the last backup.
                    try {
                        const fs = require('fs');
                        if (fs.existsSync(backupName)) {
                            fs.unlinkSync(backupName);
                            console.log(`[DB] Deleted old backup: ${backupName}`);
                        }
                    } catch (e) {
                        console.warn('[DB] Failed to delete old backup:', e);
                    }

                    console.log(`[DB] Backing up to ${backupName}...`);
                    await this.db.backup(backupName);
                    console.log('[DB] Backup complete.');
                }
            }
        } catch (e) {
            console.error('[DB] Backup failed! Proceeding with caution...', e);
            // Optional: Throw if backup is critical? For now, log and proceed (or user can't login).
        }

        // Check Version
        const currentVersion = this.db.pragma('user_version', { simple: true });
        console.log(`[DB] Current Schema Version: ${currentVersion}`);

        // Transactional Migration
        const runMigrations = this.db.transaction(() => {
            for (const migration of MIGRATIONS) {
                if (migration.version > currentVersion) {
                    console.log(`[DB] Migrating to v${migration.version}...`);
                    migration.up(this.db);
                    this.db.pragma(`user_version = ${migration.version}`);
                }
            }
        });

        try {
            runMigrations();
            console.log(`[DB] Migration check complete. Version: ${this.db.pragma('user_version', { simple: true })}`);
        } catch (err) {
            console.error('[DB] MIGRATION FAILED! Rolling back transaction.', err);
            throw err; // Critical failure
        }
    }

    async ensureAdminUser(password: string) {
        const hash = await import('argon2').then(a => a.hash(password));
        const admin = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!admin) {
            this.db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'Administrator');
            console.log('Default admin user created.');
        } else {
            // Update admin password to match current DB key - ensures they are always in sync
            this.db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, 'admin');
            console.log('Admin password synced with DB key.');
        }

        // Migration: Add doctor fields to users if missing
        try { this.db.exec(`ALTER TABLE users ADD COLUMN specialty TEXT`); } catch (e) { }
        try { this.db.exec(`ALTER TABLE users ADD COLUMN license_number TEXT`); } catch (e) { }
    }

    // ... existing Settings methods ...

    // Users
    getUsers() {
        return this.db.prepare('SELECT id, username, role, name, active, created_at FROM users ORDER BY created_at DESC').all();
    }

    getUserByUsername(username: string) {
        return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    async validateUser(username: string, passwordTry: string) {
        const user = this.getUserByUsername(username);
        if (!user) { console.log('[DB] User not found:', username); return null; }
        if (user.active !== 1) { console.log('[DB] User inactive:', username, user.active); return null; }

        const argon2 = await import('argon2');
        try {
            if (await argon2.verify(user.password, passwordTry)) {
                return { id: user.id, username: user.username, role: user.role, name: user.name };
            }
        } catch (e) {
            console.error('Password verify failed', e);
        }
        return null;
    }

    async saveUser(user: any) {
        const argon2 = await import('argon2');
        if (user.id) {
            // Update
            // Update
            let query = `UPDATE users SET role = @role, name = @name, active = @active, specialty = @specialty, license_number = @license_number WHERE id = @id`;
            if (user.password) {
                user.password = await argon2.hash(user.password);
                query = `UPDATE users SET role = @role, name = @name, active = @active, specialty = @specialty, license_number = @license_number, password = @password WHERE id = @id`;
            }
            return this.db.prepare(query).run(user);
        } else {
            // Insert
            if (!user.password) throw new Error('Password required for new user');

            console.log(`[DB] Creating user ${user.username}`);
            user.password = await argon2.hash(user.password);

            user.active = user.active !== undefined ? user.active : 1; // Default to active
            return this.db.prepare(`
                INSERT INTO users(username, password, role, name, active, specialty, license_number)
                VALUES(@username, @password, @role, @name, @active, @specialty, @license_number)
            `).run(user);
        }
    }

    deleteUser(id: number) {
        return this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }

    // ... existing methods ...
    getSettings() {
        return this.db.prepare('SELECT * FROM settings LIMIT 1').get();
    }

    // ... (existing code)

    getPublicSettings() {
        return this.db.prepare('SELECT clinic_name, doctor_name, logo_path, cloud_enabled FROM settings LIMIT 1').get();
    }

    // RBAC
    getPermissions(role: string): string[] {
        const result = this.db.prepare('SELECT permissions FROM roles WHERE name = ?').get(role);
        if (result && result.permissions) {
            try { return JSON.parse(result.permissions); } catch (e) { return []; }
        }
        return [];
    }

    getAllRoles() {
        return this.db.prepare('SELECT * FROM roles').all().map((r: any) => {
            try {
                return {
                    name: r.name,
                    permissions: JSON.parse(r.permissions)
                };
            } catch (e) {
                console.warn(`[DB] Failed to parse permissions for role ${r.name}`, e);
                return { name: r.name, permissions: [] };
            }
        });
    }

    saveRole(name: string, permissions: string[]) {
        const json = JSON.stringify(permissions);
        return this.db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET permissions = excluded.permissions').run(name, json);
    }

    saveSettings(settings: any) {
        // ... (existing code)
        const existing = this.getSettings();

        // Allowed columns whitelist to prevent SQL injection
        const ALLOWED_COLUMNS = [
            'clinic_name', 'doctor_name', 'logo_path', 'license_key',
            'drive_tokens', 'cloud_clinic_id', 'cloud_api_key', 'cloud_enabled'
        ];

        // Filter incoming settings to only allowed columns
        const validKeys = Object.keys(settings).filter(k => ALLOWED_COLUMNS.includes(k));

        if (validKeys.length === 0) return; // Nothing to update/insert

        if (existing) {
            // Build dynamic update query using whitelisted keys
            const setClause = validKeys.map(k => `${k} = @${k}`).join(', ');
            // We must pass only the valid properties to .run() to match the placeholders
            const params: any = {};
            validKeys.forEach(k => params[k] = settings[k]);

            this.db.prepare(`UPDATE settings SET ${setClause}`).run(params);
        } else {
            // First insert
            const placeholders = validKeys.map(k => `@${k}`).join(', ');
            const cols = validKeys.join(', ');

            const params: any = {};
            validKeys.forEach(k => params[k] = settings[k]);

            this.db.prepare(`INSERT INTO settings(${cols}) VALUES(${placeholders})`).run(params);
        }
    }

    getDashboardStats() {
        const totalPatients = this.db.prepare('SELECT count(*) as count FROM patients').get().count;
        // Today's visits: date >= start of day
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = this.db.prepare('SELECT count(*) as count FROM visits WHERE date(date) = ?').get(today).count;
        return { totalPatients, todayVisits };
    }

    // Doctors
    getDoctors() {
        return this.db.prepare(`SELECT * FROM users WHERE role = 'doctor' AND active = 1`).all();
    }

    // Patients
    getPatients(query: string = '') {
        if (!query) {
            return this.db.prepare('SELECT * FROM patients ORDER BY created_at DESC LIMIT 50').all();
        }
        const search = `%${query.trim()}%`;
        return this.db.prepare(`
        SELECT * FROM patients 
      WHERE name LIKE ? OR mobile LIKE ?
            ORDER BY created_at DESC
                `).all(search, search);
    }

    getPatientById(id: number) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    }

    savePatient(patientData: any) {
        // Ensure all fields exist for named parameters
        const defaults = {
            dob: null, blood_group: null, email: null,
            emergency_contact_name: null, emergency_contact_mobile: null,
            street: null, city: null, state: null, zip_code: null,
            insurance_provider: null, policy_number: null,
            address: '', age: 0, gender: 'Unknown', mobile: '', name: ''
        };

        const patient = { ...defaults, ...patientData };

        if (patient.id) {
            return this.db.prepare(`
        UPDATE patients SET
            name = @name,
            mobile = @mobile,
            age = @age,
            gender = @gender,
            address = @address,
            dob = @dob,
            blood_group = @blood_group,
            email = @email,
            emergency_contact_name = @emergency_contact_name,
            emergency_contact_mobile = @emergency_contact_mobile,
            street = @street,
            city = @city,
            state = @state,
            zip_code = @zip_code,
            insurance_provider = @insurance_provider,
            policy_number = @policy_number
        WHERE id = @id
            `).run(patient);
        } else {
            if (!patient.uuid) {
                patient.uuid = crypto.randomUUID();
            }
            return this.db.prepare(`
        INSERT INTO patients(
            uuid, name, mobile, age, gender, address, 
            dob, blood_group, email, emergency_contact_name, emergency_contact_mobile,
            street, city, state, zip_code, insurance_provider, policy_number
        )
        VALUES(
            @uuid, @name, @mobile, @age, @gender, @address,
            @dob, @blood_group, @email, @emergency_contact_name, @emergency_contact_mobile,
            @street, @city, @state, @zip_code, @insurance_provider, @policy_number
        )
            `).run(patient);
        }
    }

    // Delete Patient (and their visits)
    deletePatient(id: number) {
        // Transaction manually
        this.db.prepare('DELETE FROM visits WHERE patient_id = ?').run(id);
        return this.db.prepare('DELETE FROM patients WHERE id = ?').run(id);
    }

    // Visits
    getVisits(patientId: number) {
        const visits = this.db.prepare(`
            SELECT v.*, d.name as doctor_name 
            FROM visits v 
            LEFT JOIN users d ON v.doctor_id = d.id 
            WHERE v.patient_id = ?
            ORDER BY v.date DESC
        `).all(patientId);
        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : []
        }));
    }

    getAllVisits(limit: number = 50) {
        const visits = this.db.prepare(`
            SELECT v.*, p.name as patient_name, d.name as doctor_name 
            FROM visits v 
            JOIN patients p ON v.patient_id = p.id
            LEFT JOIN users d ON v.doctor_id = d.id 
            ORDER BY v.date DESC
            LIMIT ?
        `).all(limit);
        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : []
        }));
    }

    deleteVisit(id: number) {
        return this.db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    }

    saveVisit(visit: any) {
        const data = {
            ...visit,
            prescription_json: JSON.stringify(visit.prescription || [])
        };

        const result = (() => {
            if (visit.id) {
                return this.db.prepare(`
            UPDATE visits SET
                diagnosis = @diagnosis,
                prescription_json = @prescription_json,
                amount_paid = @amount_paid,
                doctor_id = @doctor_id,
                symptoms = @symptoms,
                examination_notes = @examination_notes,
                diagnosis_type = @diagnosis_type
            WHERE id = @id
            `).run(data);
            } else {
                return this.db.prepare(`
            INSERT INTO visits(
                patient_id, doctor_id, diagnosis, prescription_json, amount_paid, 
                symptoms, examination_notes, diagnosis_type
            )
            VALUES(
                @patient_id, @doctor_id, @diagnosis, @prescription_json, @amount_paid,
                @symptoms, @examination_notes, @diagnosis_type
            )
            `).run(data);
            }
        })();

        return result;
    }



    // Vitals
    saveVitals(vitals: any) {
        if (vitals.id) {
            return this.db.prepare(`
                UPDATE vitals SET
                height = @height,
                weight = @weight,
                bmi = @bmi,
                temperature = @temperature,
                systolic_bp = @systolic_bp,
                diastolic_bp = @diastolic_bp,
                pulse = @pulse,
                respiratory_rate = @respiratory_rate,
                spo2 = @spo2
                WHERE id = @id
            `).run(vitals);
        } else {
            return this.db.prepare(`
                INSERT INTO vitals(
                    visit_id, patient_id, height, weight, bmi, 
                    temperature, systolic_bp, diastolic_bp, pulse, respiratory_rate, spo2
                )
                VALUES(
                    @visit_id, @patient_id, @height, @weight, @bmi, 
                    @temperature, @systolic_bp, @diastolic_bp, @pulse, @respiratory_rate, @spo2
                )
            `).run(vitals);
        }
    }

    getVitals(patientId: number) {
        // Get latest vitals for patient
        return this.db.prepare(`
            SELECT * FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1
        `).get(patientId);
    }


    // Queue Management
    getQueue() {
        return this.db.prepare(`
            SELECT q.id, q.patient_id, q.status, q.priority, q.check_in_time, 
                   p.name as patient_name, p.gender, p.age, p.mobile 
            FROM patient_queue q
            JOIN patients p ON q.patient_id = p.id
            WHERE q.status != 'completed'
            ORDER BY q.priority DESC, q.check_in_time ASC
        `).all();
    }

    addToQueue(patientId: number, priority: number = 1, actingUserId: number) {
        // Check if already in queue
        const existing = this.db.prepare('SELECT id FROM patient_queue WHERE patient_id = ? AND status != ?').get(patientId, 'completed');
        if (existing) throw new Error('Patient already in queue');

        const result = this.db.prepare('INSERT INTO patient_queue (patient_id, priority) VALUES (?, ?)').run(patientId, priority);
        this.logAudit('INSERT', 'patient_queue', result.lastInsertRowid, actingUserId, `Added patient ${patientId} to queue`);
        return result;
    }

    updateQueueStatus(id: number, status: string, actingUserId: number) {
        const result = this.db.prepare('UPDATE patient_queue SET status = ? WHERE id = ?').run(status, id);
        this.logAudit('UPDATE', 'patient_queue', id, actingUserId, `Updated status to ${status} `);
        return result;
    }

    updateQueueStatusByPatientId(patientId: number, status: string, actingUserId: number) {
        // Update the most recent non-completed queue entry for this patient
        // Fetch ID first for audit
        const existing = this.db.prepare(`SELECT id FROM patient_queue WHERE patient_id = ? AND status != 'completed' ORDER BY check_in_time DESC LIMIT 1`).get(patientId);

        if (!existing) return { changes: 0 };

        const result = this.db.prepare(`
            UPDATE patient_queue 
            SET status = ? 
            WHERE id = ?
        `).run(status, existing.id);

        if (result.changes > 0) {
            this.logAudit('UPDATE', 'patient_queue', existing.id, actingUserId, `Updated status to ${status} for patient ${patientId}`);
        }
        return result;
    }

    removeFromQueue(id: number, actingUserId: number) {
        const result = this.db.prepare('DELETE FROM patient_queue WHERE id = ?').run(id);
        this.logAudit('DELETE', 'patient_queue', id, actingUserId, 'Removed from queue');
        return result;
    }

    // Audit Logging
    logAudit(action: string, tableName: string, recordId: number | bigint, userId: number, details: string) {
        try {
            this.db.prepare(`
                INSERT INTO audit_logs(action, table_name, record_id, user_id, details)
        VALUES(@action, @tableName, @recordId, @userId, @details)
            `).run({ action, tableName, recordId: Number(recordId), userId, details });
        } catch (e) {
            console.error('Failed to log audit:', e);
        }
    }

    getAuditLogs(limit: number = 100) {
        return this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
    }

    // Appointment Requests
    getAppointmentRequests() {
        const reqs = this.db.prepare("SELECT * FROM appointment_requests ORDER BY created_at DESC").all();
        // Removed debug logs to prevent leak
        return reqs;
    }

    saveAppointmentRequest(req: any) {
        return this.db.prepare(`
            INSERT OR IGNORE INTO appointment_requests (id, patient_name, phone, date, time, reason)
            VALUES (@id, @patient_name, @phone, @date, @time, @reason)
        `).run(req);
    }

    updateAppointmentRequestStatus(id: string, status: string) {
        return this.db.prepare('UPDATE appointment_requests SET status = ? WHERE id = ?').run(status, id);
    }

    // Appointments (Bookings)
    getAppointments(date: string) {
        if (!this.db) throw new Error('DB not initialized');
        // Join with patients to get name
        return this.db.prepare(`
            SELECT a.*, p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender, p.address
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.date = ?
            ORDER BY a.time ASC
        `).all(date);
    }

    saveAppointment(appt: any) {
        if (!this.db) throw new Error('DB not initialized');
        if (appt.id) {
            return this.db.prepare(`
                UPDATE appointments SET status = ? WHERE id = ?
            `).run(appt.status, appt.id);
        } else {
            return this.db.prepare(`
                INSERT INTO appointments (patient_id, date, time, reason, status)
                VALUES (?, ?, ?, ?, 'CONFIRMED')
            `).run(appt.patient_id, appt.date, appt.time, appt.reason);
        }
    }

    logStats() {
        if (!this.db) return;
        try {
            const users = this.db.prepare('SELECT count(*) as c FROM users').get().c;
            const patients = this.db.prepare('SELECT count(*) as c FROM patients').get().c;
            const visits = this.db.prepare('SELECT count(*) as c FROM visits').get().c;
            const queue = this.db.prepare('SELECT count(*) as c FROM patient_queue').get().c;
            console.log('--- [DB STATS] ---');
            console.log(`Users: ${users}`);
            console.log(`Patients: ${patients}`);
            console.log(`Visits: ${visits}`);
            console.log(`Queue: ${queue}`);
            console.log('------------------');
        } catch (e) {
            console.error('Failed to log stats:', e);
        }
    }
}


const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const SERVER_PORT = 4001;
const API_URL = `http://127.0.0.1:${SERVER_PORT}/api/v1`;
const APP_SECRET = 'nalam_build_secret_v1';

describe('Cloud API Integration Tests', async () => {
    let serverProcess;
    let clinicId;
    let apiKey;
    let validSlotId;

    before(async () => {
        // Start Server on custom port
        const testDbPath = path.join(process.cwd(), 'server', 'test', 'test.db');
        // Delete previous test DB if exists
        try { fs.unlinkSync(testDbPath); } catch (e) { }
        try { fs.unlinkSync(testDbPath + '-wal'); } catch (e) { }
        try { fs.unlinkSync(testDbPath + '-shm'); } catch (e) { }

        const env = { ...process.env, PORT: SERVER_PORT.toString(), APP_SECRET, DB_PATH: testDbPath };

        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        console.log(`Starting Test Server with ${npmCmd}...`);

        serverProcess = spawn(npmCmd, ['run', 'dev'], {
            env,
            cwd: path.join(process.cwd(), 'server'),
            stdio: 'pipe',
            shell: true
        });

        // Wait for server to be ready
        await new Promise((resolve, reject) => {
            const onData = (data) => {
                const log = data.toString();
                // console.log('[SERVER]', log);
                if (log.includes('Server listening')) {
                    serverProcess.stdout.off('data', onData);
                    resolve();
                }
            };
            serverProcess.stdout.on('data', onData);
            serverProcess.stderr.on('data', (d) => console.error('[ERR]', d.toString()));
            serverProcess.on('error', reject);
            setTimeout(() => reject(new Error('Server timeout')), 10000);
        });
    });

    after(() => {
        if (serverProcess) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
            } else {
                serverProcess.kill();
            }
        }
    });

    test('POST /onboard - Should register a clinic', async () => {
        const res = await fetch(`${API_URL}/onboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-secret': APP_SECRET },
            body: JSON.stringify({ name: 'Test Clinic', city: 'Test City' })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.clinicId, 'Should return clinicId');
        assert.ok(data.apiKey, 'Should return apiKey');
        clinicId = data.clinicId;
        apiKey = data.apiKey;
    });

    test('POST /slots - Should publish slots', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${API_URL}/slots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-clinic-id': clinicId,
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                slots: [
                    { date: today, time: '10:00' },
                    { date: today, time: '10:30' }
                ]
            })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'ok');
    });

    test('GET /slots/:id - Should retrieve available slots', async () => {
        const res = await fetch(`${API_URL}/slots/${clinicId}`);
        assert.strictEqual(res.status, 200);
        const slots = await res.json();
        assert.strictEqual(slots.length, 2);
        assert.strictEqual(slots[0].time, '10:00');

        validSlotId = slots[0].id;
    });

    test('POST /book - Should book a valid slot', async () => {
        const res = await fetch(`${API_URL}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slotId: validSlotId,
                patientName: 'John Doe',
                phone: '9998887777',
                reason: 'Checkup'
            })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'queued');
    });

    test('POST /book - Should fail on double booking', async () => {
        const res = await fetch(`${API_URL}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slotId: validSlotId, // Same ID
                patientName: 'Jane Doe',
                phone: '1112223333'
            })
        });

        assert.strictEqual(res.status, 409); // Conflict
        const data = await res.json();
        assert.match(data.error, /Slot already taken/);
    });

    test('POST /book - Should accept general request without slot', async () => {
        const res = await fetch(`${API_URL}/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clinicId, // Required when no slot
                patientName: 'General Inquiry',
                phone: '5556667777',
                reason: 'No slot available'
            })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'queued');
    });

    test('GET /sync - Should receive APPOINTMENT_REQUEST', async () => {
        // Wait for WAL commit potentially
        await new Promise(r => setTimeout(r, 100));

        const res = await fetch(`${API_URL}/sync`, {
            headers: { 'x-clinic-id': clinicId, 'x-api-key': apiKey }
        });

        const messages = await res.json();
        // Expecting 2 messages now (1 with slot, 1 without)
        assert.strictEqual(messages.length, 2);

        const msgBooked = messages.find(m => m.payload.slotId === validSlotId);
        const msgGeneric = messages.find(m => m.payload.slotId === null);

        assert.ok(msgBooked, 'Should find booked slot message');
        assert.ok(msgGeneric, 'Should find generic inquiry message');

        assert.strictEqual(msgBooked.type, 'APPOINTMENT_REQUEST');
        assert.strictEqual(msgBooked.payload.name, 'John Doe');

        assert.strictEqual(msgGeneric.type, 'APPOINTMENT_REQUEST');
        assert.strictEqual(msgGeneric.payload.name, 'General Inquiry');

        global.messageId = msgBooked.id;
        global.genericId = msgGeneric.id;
    });

    test('POST /ack - Should cleanup messages', async () => {
        const res = await fetch(`${API_URL}/ack`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-clinic-id': clinicId,
                'x-api-key': apiKey
            },
            body: JSON.stringify({ ids: [global.messageId, global.genericId] })
        });
        assert.strictEqual(res.status, 200);

        // Verify empty
        const check = await fetch(`${API_URL}/sync`, {
            headers: { 'x-clinic-id': clinicId, 'x-api-key': apiKey }
        });
        const final = await check.json();
        assert.strictEqual(final.length, 0);
    });
});

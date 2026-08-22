
import { SecurityService } from './services/SecurityService';
import type { DeviceKeyStore } from './services/DeviceKeyStore';
import * as fs from 'fs';
import * as path from 'path';

async function testSecurity() {
    const dbPath = path.join(__dirname, 'test.db');
    const userDataPath = path.join(__dirname, 'test_user_data');
    if (fs.existsSync(userDataPath)) fs.rmSync(userDataPath, { recursive: true, force: true });
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    let protectedKey: Buffer | null = null;
    const deviceStore: DeviceKeyStore = {
        status: () => ({ available: true, provider: 'verification-memory-store' }),
        protect: (value) => { protectedKey = Buffer.from(value); return Buffer.from(value); },
        unprotect: () => { if (!protectedKey) throw new Error('missing key'); return Buffer.from(protectedKey); }
    };
    const security = new SecurityService(deviceStore);
    const password = 'adminLoginPassword';

    console.log('1. Creating a fresh device-bound vault...');
    await security.setup(password, dbPath, userDataPath);

    const db = security.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, secret TEXT)`);
    db.prepare(`INSERT INTO test (secret) VALUES (?)`).run('This is a secret message');

    console.log('2. Data inserted. Closing DB.');
    security.closeDb();

    console.log('3. Cold-starting without a user password...');
    try {
        const security3 = new SecurityService(deviceStore);
        await security3.initializeDevice(dbPath, userDataPath);
        const row = security3.getDb().prepare('SELECT * FROM test').get() as any;
        if (row && row.secret === 'This is a secret message') {
            console.log('PASS: Data recovered successfully:', row.secret);
        } else {
            console.error('FAIL: Data corruption or match failure.');
        }
        security3.closeDb();
    } catch (e) {
        console.error('FAIL: Could not reopen with the device key:', e);
    }

    // Cleanup
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(userDataPath)) fs.rmSync(userDataPath, { recursive: true, force: true });
}

// Entry point
(async () => {
    try {
        await testSecurity();
    } catch (err) {
        console.error('[verify-security] Unhandled error:', err);
        process.exit(1);
    }
})();

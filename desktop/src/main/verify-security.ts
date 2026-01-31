
import { SecurityService } from './services/SecurityService';
import * as fs from 'fs';
import * as path from 'path';

async function testSecurity() {
    const dbPath = path.join(__dirname, 'test.db');
    const userDataPath = path.join(__dirname, 'test_user_data');
    if (fs.existsSync(userDataPath)) fs.rmSync(userDataPath, { recursive: true, force: true });
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const security = new SecurityService();
    const password = 'mySecretPassword';

    console.log('1. Initializing DB (Fresh)...');
    await security.initialize(password, dbPath, userDataPath);

    const db = security.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, secret TEXT)`);
    db.prepare(`INSERT INTO test (secret) VALUES (?)`).run('This is a secret message');

    console.log('2. Data inserted. Closing DB.');
    security.closeDb();

    console.log('3. Attempting to open with WRONG password...');
    const security2 = new SecurityService();
    try {
        await security2.initialize('wrongPassword', dbPath, userDataPath);
        console.error('FAIL: Database should NOT open with wrong key!');
    } catch (e: any) {
        if (e.message === 'INVALID_PASSWORD') {
            console.log('PASS: Correctly rejected wrong password.');
        } else {
            console.error('FAIL: Unexpected error:', e);
        }
    }

    console.log('4. Attempting to open with CORRECT password...');
    try {
        const security3 = new SecurityService();
        await security3.initialize(password, dbPath, userDataPath);
        const row = security3.getDb().prepare('SELECT * FROM test').get() as any;
        if (row && row.secret === 'This is a secret message') {
            console.log('PASS: Data recovered successfully:', row.secret);
        } else {
            console.error('FAIL: Data corruption or match failure.');
        }
        security3.closeDb();
    } catch (e) {
        console.error('FAIL: Could not reopen with correct key:', e);
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

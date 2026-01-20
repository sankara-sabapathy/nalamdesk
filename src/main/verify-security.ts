
import { SecurityService } from './services/SecurityService';
import * as fs from 'fs';
import * as path from 'path';

async function testSecurity() {
    const dbPath = path.join(__dirname, 'test.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const security = new SecurityService();

    console.log('1. Deriving key...');
    const password = 'mySecretPassword';
    const key = await security.deriveKey(password);
    console.log('Key derived:', key.toString('hex'));

    console.log('2. Initializing DB with key...');
    security.initDb(dbPath, key);

    const db = security.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, secret TEXT)`);
    db.prepare(`INSERT INTO test (secret) VALUES (?)`).run('This is a secret message');

    console.log('3. Data inserted. Closing DB.');
    security.closeDb();

    console.log('4. Attempting to open with WRONG password...');
    const wrongKey = await security.deriveKey('wrongPassword');
    try {
        const security2 = new SecurityService();
        security2.initDb(dbPath, wrongKey);
        console.error('FAIL: Database should NOT open with wrong key!');
    } catch (e: any) {
        if (e.message === 'INVALID_PASSWORD') {
            console.log('PASS: Correctly rejected wrong password.');
        } else {
            console.error('FAIL: Unexpected error:', e);
        }
    }

    console.log('5. Attempting to open with CORRECT password...');
    try {
        const security3 = new SecurityService();
        security3.initDb(dbPath, key);
        const row = security3.getDb().prepare('SELECT * FROM test').get();
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
}

testSecurity();

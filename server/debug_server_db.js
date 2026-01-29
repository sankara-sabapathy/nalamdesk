const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data', 'nalamdesk.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);
const rows = db.prepare('SELECT * FROM messages').all();
console.log('--- Messages Count:', rows.length, '---');
if (rows.length > 0) {
    console.log('First Message:', JSON.stringify(rows[0], null, 2));
}

const slots = db.prepare('SELECT count(*) as count FROM slots').get();
console.log('--- Slots Count:', slots.count, '---');

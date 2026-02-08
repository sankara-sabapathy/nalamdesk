const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'nalamdesk.db')); // Server is in /server, db is in /nalamdesk.db

console.log('=== CLINICS ===');
console.log(db.prepare('SELECT * FROM clinics').all());

console.log('\n=== MESSAGES ===');
console.log(db.prepare('SELECT * FROM messages').all());

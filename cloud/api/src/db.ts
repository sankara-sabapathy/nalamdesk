import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Allow overriding DB path for testing
const dbName = process.env.DB_PATH || path.join(dataDir, 'nalamdesk.db');
const db = new Database(dbName);

// Enable WAL mode for concurrency
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    specialty TEXT,
    api_key_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'APPOINTMENT' | 'OTHER'
    payload JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_messages_clinic_id ON messages(clinic_id);

  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    time TEXT NOT NULL, -- HH:mm
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, HELD, BOOKED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_slots_clinic_date ON slots(clinic_id, date);
`);

// Migration: Add specialty if missing
try {
  db.exec('ALTER TABLE clinics ADD COLUMN specialty TEXT');
} catch (e) {
  // Column likely exists
}


export default db;

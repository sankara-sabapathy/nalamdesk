
import * as path from 'path';
import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';

// Load Env
dotenv.config();

import { DatabaseService } from '../main/services/DatabaseService';
import { ApiServer } from './app';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || 'nalamdesk.db';

// Ensure data directory exists if path implies one?
// For now, let better-sqlite3 handle it or fail.

console.log(`[Server] Starting...`);
console.log(`[Server] DB Path: ${DB_PATH}`);

// 1. Initialize Database
let db;
try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Performance
} catch (e) {
    console.error('[Server] Failed to open DB:', e);
    process.exit(1);
}

const databaseService = new DatabaseService();
databaseService.setDb(db);

// 2. Run Migrations
(async () => {
    try {
        await databaseService.migrate();
        // Ensure Admin exists using ENV password or default?
        // Ideally we should use a Setup flow, but for MVP:
        if (process.env.ADMIN_PASSWORD) {
            await databaseService.ensureAdminUser(process.env.ADMIN_PASSWORD);
        }
    } catch (e) {
        console.error('[Server] Migration failed:', e);
        process.exit(1);
    }

    // 3. Start API Server
    // Static Path: In Docker/Prod, we expect 'public' or 'browser' folder alongside this script's dist?
    // We will assume `dist/nalamdesk/browser` exists relative to CWD or `dist/server`.
    // If run from root `node dist/server/index.js`, then `dist/nalamdesk/browser` is sibling.

    // Logic: 
    // If running from <Project>/dist/server/index.js
    // Client is at <Project>/dist/nalamdesk/browser
    const staticPath = process.env.STATIC_PATH || path.join(process.cwd(), 'dist', 'nalamdesk', 'browser');

    const apiServer = new ApiServer(databaseService, staticPath);
    await apiServer.start(PORT, HOST);
})();

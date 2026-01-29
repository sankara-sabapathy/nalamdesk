import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import { SessionService } from './services/SessionService';
import { BackupService } from './services/BackupService';
import { CrashService } from './services/CrashService';
import { SecurityService } from './services/SecurityService';
import { DatabaseService } from './services/DatabaseService';
import { GoogleDriveService } from './services/GoogleDriveService';
import { CloudSyncService } from './services/CloudSyncService';
import { ApiServer } from '../server/app';



// ... (logging config)

// Initialize Crash Service immediately to catch early errors
const crashService = new CrashService();

let mainWindow: BrowserWindow | null = null;
const securityService = new SecurityService();
const databaseService = new DatabaseService();
const googleDriveService = new GoogleDriveService();
const cloudSyncService = new CloudSyncService(databaseService);

// Determine Static Path for ApiServer
const isDev = !app.isPackaged;
const staticPath = isDev
    ? path.join(__dirname, '../nalamdesk/browser')
    : path.join(app.getAppPath(), 'dist/nalamdesk/browser');

const apiServer = new ApiServer(databaseService, staticPath);
const sessionService = new SessionService();
const backupService = new BackupService(databaseService, googleDriveService, securityService);

// ... (cloud sync init logic)
apiServer.start();

// Removing global currentUser variable
// let currentUser: any = null; 

// ... (rest of window creation)

// IPC Handlers
ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        const { username, password } = credentials;
        let dbOpen = false;
        try {
            dbOpen = !!securityService.getDbPath();
        } catch { dbOpen = false; }

        if (username === 'admin') {
            try {
                const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
                const dbPath = app.isPackaged
                    ? path.join(app.getPath('userData'), dbName)
                    : path.join(__dirname, '../../', dbName);

                const key = await securityService.deriveKey(password);
                try {
                    securityService.initDb(dbPath, key);
                    databaseService.setDb(securityService.getDb());
                    await databaseService.migrate();
                    await databaseService.ensureAdminUser(password);
                } catch (e: any) {
                    if (e.message !== 'DB_ALREADY_OPEN') throw e;
                    databaseService.setDb(securityService.getDb());
                }

                const settings = databaseService.getSettings();
                if (settings && settings.drive_tokens) {
                    googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
                    backupService.scheduleDailyBackup(); // Automated Backup
                }
            } catch (e: any) {
                console.error('DB Init failed:', e);
                return { success: false, error: 'INVALID_CREDENTIALS' };
            }
        } else {
            try {
                const db = securityService.getDb();
                databaseService.setDb(db);
            } catch (e) {
                return { success: false, error: 'SYSTEM_LOCKED' };
            }
        }

        cloudSyncService.init();

        console.log(`[Auth] Validating user: ${username}`);
        const user = await databaseService.validateUser(username, password);
        console.log(`[Auth] Validation result:`, user ? 'Success' : 'Failed');
        if (user) {
            sessionService.setUser(user); // Use SessionService
            return { success: true, user };
        } else {
            return { success: false, error: 'INVALID_CREDENTIALS' };
        }

    } catch (error: any) {
        console.error('Login failed:', error);
        return { success: false, error: 'UNKNOWN_ERROR' };
    }
});

// ... (Database IPC Handlers)

// Queue IPC Handlers
ipcMain.handle('db:getQueue', () => databaseService.getQueue());
ipcMain.handle('db:addToQueue', (_, { patientId, priority }) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.addToQueue(patientId, priority, user.id);
});
ipcMain.handle('db:updateQueueStatus', (_, { id, status }) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.updateQueueStatus(id, status, user.id);
});
ipcMain.handle('db:updateQueueStatusByPatientId', (_, { patientId, status }) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.updateQueueStatusByPatientId(patientId, status, user.id);
});
ipcMain.handle('db:removeFromQueue', (_, id) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.removeFromQueue(id, user.id);
});

// Audit IPC Handlers
ipcMain.handle('db:getAuditLogs', (_, limit) => databaseService.getAuditLogs(limit));

// Cloud IPC Handlers
// Cloud IPC Handlers
ipcMain.handle('cloud:getStatus', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return cloudSyncService.getStatus();
});
ipcMain.handle('cloud:onboard', (_, { name, city }) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return cloudSyncService.onboard(name, city);
});
ipcMain.handle('cloud:toggle', (_, enabled) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return cloudSyncService.setEnabled(enabled);
});
ipcMain.handle('cloud:publishSlots', (_, slots, dates) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return cloudSyncService.publishSlots(slots, dates);
});
ipcMain.handle('cloud:syncNow', async () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    await cloudSyncService.poll();
    return { success: true };
});
ipcMain.handle('cloud:getPublishedSlots', (_, date) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return cloudSyncService.getPublishedSlots(date);
});

// Appointment Request IPC
// Appointment Request IPC
ipcMain.handle('db:getAppointmentRequests', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getAppointmentRequests();
});
ipcMain.handle('db:updateAppointmentRequestStatus', (_, { id, status }) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.updateAppointmentRequestStatus(id, status);
});

// Appointments (Bookings) IPC
// Appointments (Bookings) IPC
ipcMain.handle('db:getAppointments', (_, date) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getAppointments(date);
});
ipcMain.handle('db:saveAppointment', (_, appt) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.saveAppointment(appt);
});

// Drive IPC Handlers
ipcMain.handle('drive:authenticate', async () => {
    if (!mainWindow) return false;
    try {
        await googleDriveService.authenticate(mainWindow);
        const tokens = googleDriveService.getCredentials();
        databaseService.saveSettings({ drive_tokens: JSON.stringify(tokens) });
        return true;
    } catch (e) {
        console.error('Drive auth failed', e);
        return false;
    }
});

ipcMain.handle('drive:backup', async () => {
    try {
        const dbPath = securityService.getDbPath();
        if (!dbPath) throw new Error('DB not open');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `nalamdesk-backup-${timestamp}.db`;
        await googleDriveService.uploadFile(dbPath, fileName);
        return { success: true };
    } catch (e: any) {
        console.error('Backup failed', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('drive:restore', async (_, fileId) => {
    try {
        const dbPath = securityService.getDbPath();
        if (!dbPath) throw new Error('DB not open');
        securityService.closeDb();
        await googleDriveService.downloadFile(fileId, dbPath);
        return { success: true, restartRequired: true };
    } catch (e: any) {
        console.error('Restore failed', e.message); // e might be object
        return { success: false, error: String(e) };
    }
});

ipcMain.handle('drive:listBackups', async () => {
    try {
        return await googleDriveService.listBackups();
    } catch (e) {
        return [];
    }
});




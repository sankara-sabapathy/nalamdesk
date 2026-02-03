import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
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



import { session } from 'electron';

// ... (logging config)

// Initialize Crash Service immediately to catch early errors
const crashService = new CrashService();

// Disable Hardware Acceleration to prevent input freezing/rendering glitches
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
const securityService = new SecurityService();
const databaseService = new DatabaseService();
const googleDriveService = new GoogleDriveService();
const cloudSyncService = new CloudSyncService(databaseService);

// Determine Static Path for ApiServer
const isDev = !app.isPackaged;
const staticPath = isDev
    ? path.join(__dirname, '../../dist/nalamdesk/browser')
    : path.join(app.getAppPath(), 'dist/nalamdesk/browser');

// Ensure static path exists (crucial for Dev mode if not built)
const fs = require('fs');
if (!fs.existsSync(staticPath)) {
    console.log(`[Main] Creating missing static path: ${staticPath}`);
    fs.mkdirSync(staticPath, { recursive: true });
}

const apiServer = new ApiServer(databaseService, staticPath);
const sessionService = new SessionService();
const backupService = new BackupService(databaseService, googleDriveService, securityService);

// ... (cloud sync init logic)
// DB init happens via IPC. ApiServer will report 503 if DB not ready (guarded in handler).
// ... (cloud sync init logic)
console.log('[Main] Starting ApiServer...');
try {
    apiServer.start(); // Fire and forget (it logs its own success)
    console.log('[Main] ApiServer start command issued.');
} catch (e) {
    console.error('[Main] ApiServer failed to start immediately:', e);
}

// Removing global currentUser variable
// let currentUser: any = null; 

// ... (rest of window creation)

async function createWindow() {
    console.log('[Main] createWindow called');
    try {
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            icon: isDev
                ? path.join(__dirname, '../../build/icon.png')
                : path.join(app.getAppPath(), 'build/icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
            },
        });

        // Remove default menu bar completely
        mainWindow.setMenu(null);
        console.log('[Main] BrowserWindow created');

        if (isDev) {
            console.log('[Main] Loading URL: http://localhost:4200');
            await mainWindow.loadURL('http://localhost:4200');
            console.log('[Main] URL loaded');
        } else {
            console.log(`[Main] Loading File: ${path.join(staticPath, 'index.html')}`);
            await mainWindow.loadFile(path.join(staticPath, 'index.html'));
            console.log('[Main] File loaded');
        }
    } catch (e) {
        console.error('[Main] createWindow error:', e);
    }
}

app.whenReady().then(() => {
    console.log('[Main] app.whenReady fired');
    // 1. CSP (Content Security Policy)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Skip external origins
        try {
            const url = new URL(details.url);
            if (url.protocol !== 'file:' && url.hostname !== 'localhost') {
                return callback({});
            }
        } catch { return callback({}); }

        const devCSP = "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self' http://localhost:3000 https://www.googleapis.com https://accounts.google.com; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:;";
        const prodCSP = "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline'; connect-src 'self' https://www.googleapis.com https://accounts.google.com; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:;";

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [isDev ? devCSP : prodCSP],
            },
        });
    });

    // 2. Permission Handler (Deny by default)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        // Allowed permissions
        const allowedPermissions = ['media']; // e.g. for camera if needed later
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            console.warn(`[Security] Denied permission request: ${permission}`);
            callback(false);
        }
    });

    // 3. Navigation Guard
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        let urlObj: URL;
        try {
            urlObj = new URL(details.url);
        } catch {
            return callback({ cancel: true }); // Invalid URL
        }

        // Allow DevTools, File, and Localhost
        if (urlObj.protocol === 'devtools:' || urlObj.protocol === 'file:' || urlObj.hostname === 'localhost') {
            return callback({ cancel: false });
        }

        // Allow specific Google hosts for OAuth
        const trustedHosts = ['accounts.google.com', 'www.googleapis.com'];
        if (urlObj.protocol === 'https:' && trustedHosts.some(h => urlObj.hostname === h || urlObj.hostname.endsWith('.' + h))) {
            return callback({ cancel: false });
        }

        console.warn(`[Security] Blocked request: ${details.url}`);
        callback({ cancel: true });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// IPC Handlers
// IPC Handlers
ipcMain.handle('auth:checkSetup', () => {
    const userDataPath = app.getPath('userData');
    return securityService.isSetup(userDataPath);
});

ipcMain.handle('auth:setup', async (event, { password, clinicDetails, adminDetails }) => {
    try {
        console.log('[Auth] Starting Setup...');
        const userDataPath = app.getPath('userData');
        const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
        const dbPath = app.isPackaged
            ? path.join(userDataPath, dbName)
            : path.join(__dirname, '../../', dbName);

        // 1. Setup Security (Generates DEK + Recovery Code)
        const recoveryCode = await securityService.setup(password, dbPath, userDataPath);

        // 2. Set DB Service
        databaseService.setDb(securityService.getDb());

        // 3. Migrate DB Schema
        await databaseService.migrate();

        // 4. Save Settings
        await databaseService.saveSettings(clinicDetails);

        // 5. Create Admin User
        // We pass password here, but remember, Auth is now decoupled from DB Key.
        // The Admin Password is the same as the Master Password for simplicity in V1/V2 transition.
        await databaseService.ensureAdminUser(password);

        console.log('[Auth] Setup Complete.');
        return { success: true, recoveryCode };
    } catch (e: any) {
        console.error('[Auth] Setup failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('auth:recover', async (event, { recoveryCode, newPassword }) => {
    try {
        console.log('[Auth] Starting Recovery...');
        const userDataPath = app.getPath('userData');
        const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
        const dbPath = app.isPackaged
            ? path.join(userDataPath, dbName)
            : path.join(__dirname, '../../', dbName);

        // 1. Recover Vault
        const newRecoveryCode = await securityService.recover(recoveryCode, newPassword, userDataPath, dbPath);

        // 2. Set DB
        databaseService.setDb(securityService.getDb());

        // 3. Update Admin Password in DB (since we reset it)
        // Note: We need a way to find the admin user and update their password hash.
        // DatabaseService needs a method for this.
        // For now, let's assume 'admin' user exists.
        await databaseService.updateUserPassword('admin', newPassword);

        return { success: true, recoveryCode: newRecoveryCode };
    } catch (e: any) {
        console.error('[Auth] Recovery failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('auth:regenerateRecoveryCode', async (event, { password }) => {
    try {
        const user = sessionService.getUser();
        if (!user || user.role !== 'admin') throw new Error('Forbidden');

        console.log('[Auth] Regenerating Recovery Code...');
        const recoveryCode = await securityService.regenerateRecoveryCode(password);
        return { success: true, recoveryCode };
    } catch (e: any) {
        console.error('[Auth] Regenerate Recovery Code failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('clipboard:writeText', (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        const { username, password } = credentials;

        // 1. Initialize / Unlock DB if not already open
        if (!securityService.getDb()) {
            try {
                const userDataPath = app.getPath('userData');
                const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
                const dbPath = app.isPackaged
                    ? path.join(userDataPath, dbName)
                    : path.join(__dirname, '../../', dbName);

                // This handles Unlock OR V1->V2 Migration
                await securityService.initialize(password, dbPath, userDataPath);

                databaseService.setDb(securityService.getDb());

                // If migration happened, we might want to ensure schema is up to date?
                // V2 Migration does NOT run schema migrations automatically, but V1 Logic did.
                // Let's run migrate just in case (safe idempotent)
                await databaseService.migrate();

            } catch (e: any) {
                if (e.message === 'INVALID_PASSWORD') {
                    // If DB unlock fails, we can't proceed.
                    // But wait! If the user is NOT admin, they can't unlock the DB.
                    // They rely on DB being already open.
                } else if (e.message === 'NOT_SETUP') {
                    return { success: false, error: 'SETUP_REQUIRED' };
                } else {
                    console.error('DB Init failed:', e);
                    return { success: false, error: 'SYSTEM_ERROR' };
                }
            }
        }

        // 2. Check if DB is open
        const db = securityService.getDb();
        if (!db) {
            // DB is locked. Only Admin can unlock it.
            // If we are here, it means `initialize` failed or wasn't called (e.g. wrong password).

            // If the user trying to login is 'admin', then the `initialize` call above failed with INVALID_PASSWORD.
            if (username === 'admin') {
                return { success: false, error: 'INVALID_CREDENTIALS' };
            } else {
                // If normal user, they are blocked until Admin unlocks.
                return { success: false, error: 'SYSTEM_LOCKED' };
            }
        }

        databaseService.setDb(db);

        // 3. Validate User against DB
        // If we are Admin, we just unlocked the DB with the password.
        // Does that mean we are automatically logged in? 
        // Yes, if we unlocked it, we possess the master password.

        if (username === 'admin') {
            // Verify the DB internal user 'admin' also has this password?
            // V1 Logic: ensureAdminUser(password) was called on login.
            // We should probably keep that sync logic or just trust the Vault Unlock?
            // Best practice: Trust Vault Unlock for Admin.
            const user = await databaseService.getUserByUsername('admin');
            if (user) {
                sessionService.setUser(user);

                // Check if settings has drive tokens -> Schedule Backup
                const settings = databaseService.getSettings();
                if (settings && settings.drive_tokens) {
                    googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
                    backupService.scheduleDailyBackup();
                }

                return { success: true, user };
            }
        }

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

// Dashboard / Stats
ipcMain.handle('db:getDashboardStats', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getDashboardStats();
});

// Patients
ipcMain.handle('db:getPatients', (_, query) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getPatients(query);
});
ipcMain.handle('db:getPatientById', (_, id) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getPatientById(id);
});
ipcMain.handle('db:savePatient', (_, patient) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    // Basic RBAC check (doctors/receptionists) - simplified for now
    if (!['doctor', 'receptionist', 'admin'].includes(user.role)) throw new Error('Forbidden');
    return databaseService.savePatient(patient);
});
ipcMain.handle('db:deletePatient', (_, id) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.deletePatient(id);
});

// Visits
ipcMain.handle('db:getVisits', (_, patientId) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getVisits(patientId);
});
ipcMain.handle('db:getAllVisits', (_, limit) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getAllVisits(limit);
});
ipcMain.handle('db:saveVisit', (_, visit) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (!['doctor', 'admin'].includes(user.role)) throw new Error('Forbidden');
    return databaseService.saveVisit(visit);
});
ipcMain.handle('db:deleteVisit', (_, id) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.deleteVisit(id);
});
ipcMain.handle('db:getVitals', (_, patientId) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getVitals(patientId);
});
ipcMain.handle('db:saveVitals', (_, vitals) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.saveVitals(vitals);
});

// Users
ipcMain.handle('db:getUsers', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.getUsers();
});
ipcMain.handle('db:saveUser', (_, userData) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.saveUser(userData);
});
ipcMain.handle('db:deleteUser', (_, id) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.deleteUser(id);
});
ipcMain.handle('db:getDoctors', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getDoctors();
});
ipcMain.handle('db:getAllRoles', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getAllRoles();
})

// Settings
ipcMain.handle('db:getSettings', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    // if (user.role !== 'admin') throw new Error('Forbidden'); // Allow reading settings?
    return databaseService.getSettings();
});
ipcMain.handle('db:getPublicSettings', () => {
    // Public endpoint - no auth required (used for Login screen)
    return databaseService.getPublicSettings();
});
ipcMain.handle('db:saveSettings', (_, settings) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');
    return databaseService.saveSettings(settings);
});

// Queue IPC Handlers
ipcMain.handle('db:getQueue', () => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    return databaseService.getQueue();
});
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




import { app, BrowserWindow, ipcMain, clipboard, shell, dialog } from 'electron';
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

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('[Main] Another instance is already running. Quitting...');
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Proceed with App Initialization
    initializeApp();
}

let mainWindow: BrowserWindow | null = null;


// IPC Handlers for utilities
ipcMain.handle('utils:openExternal', async (_, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('utils:getLocalIp', () => {
    try {
        const os = require('os');
        const nets = os.networkInterfaces();
        console.log('[Main] Network Interfaces:', Object.keys(nets));
        for (const name of Object.keys(nets)) {
            for (const net of nets[name] || []) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    console.log('[Main] Found IP:', net.address);
                    return net.address;
                }
            }
        }
        console.log('[Main] IP not found, returning localhost');
        return 'localhost';
    } catch (e) {
        console.error('[Main] getLocalIp error:', e);
        return 'localhost';
    }
});

// Services
const userDataPath = app.getPath('userData');
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
const backupService = new BackupService(databaseService, googleDriveService, securityService, userDataPath);

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
            mainWindow.webContents.openDevTools();
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

function initializeApp() {
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

            // Allow specific Google hosts for OAuth and Fonts
            const trustedHosts = [
                'accounts.google.com',
                'www.googleapis.com',
                'fonts.googleapis.com',
                'fonts.gstatic.com'
            ];
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
}

// Global Backup on Quit Logic
let isQuitting = false;
app.on('before-quit', async (e) => {
    if (isQuitting) return;

    e.preventDefault();
    console.log('[Main] App closing... Starting final backup.');

    // Optional: Notify user via window if visible
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:quitting', 'Backing up data...');
    }

    try {
        await backupService.performBackupOnQuit();
    } catch (err) {
        console.error('[Main] Final backup failed:', err);
    }

    isQuitting = true;
    app.quit();
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

async function tryUnlockDatabase(password: string): Promise<string | null> {
    if (securityService.getDb()) return null; // Already open

    try {
        const userDataPath = app.getPath('userData');
        const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
        const dbPath = app.isPackaged
            ? path.join(userDataPath, dbName)
            : path.join(__dirname, '../../', dbName);

        // This handles Unlock OR V1->V2 Migration
        await securityService.initialize(password, dbPath, userDataPath);
        databaseService.setDb(securityService.getDb());

        // Ensure schema is up to date (safe idempotent)
        await databaseService.migrate();
        return null;
    } catch (e: any) {
        if (e.message === 'NOT_SETUP') return 'SETUP_REQUIRED';
        if (e.message === 'INVALID_PASSWORD') return 'INVALID_PASSWORD';

        console.error('DB Init failed:', e);
        return 'SYSTEM_ERROR';
    }
}

ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        const { username, password } = credentials;

        // 1. Initialize / Unlock DB
        const unlockResult = await tryUnlockDatabase(password);
        if (unlockResult === 'SETUP_REQUIRED') return { success: false, error: 'SETUP_REQUIRED' };
        if (unlockResult === 'SYSTEM_ERROR') return { success: false, error: 'SYSTEM_ERROR' };

        // 2. Check if DB is open
        const db = securityService.getDb();
        if (!db) {
            // Unlock failed (INVALID_PASSWORD)
            // If user is Admin, they MUST be able to unlock it.
            if (username === 'admin') {
                return { success: false, error: 'INVALID_CREDENTIALS' };
            } else {
                return { success: false, error: 'SYSTEM_LOCKED' };
            }
        }

        databaseService.setDb(db);

        // 3. Validate User against DB
        if (username === 'admin') {
            const user = await databaseService.getUserByUsername('admin');
            if (user) {
                // Verify admin password against DB too (optional but good for consistency)
                const argon2 = await import('argon2');
                if (await argon2.verify(user.password, password)) {
                    sessionService.setUser(user);

                    // Configure Drive & Backup for Admin
                    const settings = databaseService.getSettings();
                    if (settings) {
                        try {
                            if (settings.drive_client_id && settings.drive_client_secret) {
                                googleDriveService.configureCredentials(settings.drive_client_id, settings.drive_client_secret);
                            }
                            if (settings.drive_tokens) {
                                googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
                                backupService.initAutomatedBackup();
                            }
                        } catch (e) { console.error('Failed to configure services for admin', e); }
                    }
                    return { success: true, user };
                }
            }
            // If admin DB user not found or password mismatch (but vault unlocked? weird state)
            // Fallthrough to standard validation
        }

        console.log(`[Auth] Validating user: ${username}`);
        const result = await databaseService.validateUser(username, password);

        if (result.success && result.user) {
            sessionService.setUser(result.user);

            // Initialize Backup & Drive Services (shared logic)
            try {
                const settings = databaseService.getSettings();
                if (settings) {
                    if (settings.drive_client_id && settings.drive_client_secret) googleDriveService.configureCredentials(settings.drive_client_id, settings.drive_client_secret);
                    if (settings.drive_tokens) googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
                    if (settings.local_backup_path) backupService.initAutomatedBackup();
                }
            } catch (e) {
                console.error('Failed to configure services for user', e);
            }
            return { success: true, user: result.user };
        }

        return { success: false, error: 'INVALID_CREDENTIALS' };

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
ipcMain.handle('db:saveSettings', async (_, settings) => {
    const user = sessionService.getUser();
    if (!user) throw new Error('Unauthorized');
    if (user.role !== 'admin') throw new Error('Forbidden');

    const result = databaseService.saveSettings(settings);

    // Update Backup Schedule if changed
    if (settings.backup_schedule) {
        backupService.updateSchedule('local', settings.backup_schedule);
    }
    if (settings.cloud_backup_schedule) {
        backupService.updateSchedule('cloud', settings.cloud_backup_schedule);
    }

    // Update Drive Credebtials if changed
    if (settings.drive_client_id && settings.drive_client_secret) {
        googleDriveService.configureCredentials(settings.drive_client_id, settings.drive_client_secret);
    }

    return result;
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
ipcMain.handle('drive:authenticate', async (_, { clientId, clientSecret }) => {
    if (!mainWindow) return { success: false, error: 'Main window not found' };
    try {
        // Configure credentials first
        googleDriveService.configureCredentials(clientId, clientSecret);

        await googleDriveService.authenticate(mainWindow);
        const tokens = googleDriveService.getCredentials();

        // Save everything to settings
        databaseService.saveSettings({
            drive_client_id: clientId,
            drive_client_secret: clientSecret,
            drive_tokens: JSON.stringify(tokens)
        });

        return { success: true };
    } catch (e: any) {
        console.error('Drive auth failed', e);
        return { success: false, error: e.message || 'Authentication failed' };
    }
});

ipcMain.handle('drive:disconnect', async () => {
    try {
        googleDriveService.setCredentials(null);
        databaseService.saveSettings({ drive_tokens: '' });
        return { success: true };
    } catch (e: any) {
        console.error('Drive disconnect failed', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('drive:isAuthenticated', () => {
    return googleDriveService.isAuthenticated();
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

        // Restart app to reload DB (delay to allow IPC response)
        setTimeout(() => {
            app.relaunch();
            app.exit(0);
        }, 1500);

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

// Backup IPC
// Backup IPC
ipcMain.handle('backup:selectPath', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Backup Location',
        buttonLabel: 'Select Folder'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('backup:useDefaultPath', async () => {
    const defaultPath = path.join(app.getPath('userData'), 'backups');
    // Ensure it exists?
    // backupService sets this in constructor, so we just return the path string
    // logic in frontend will save it to settings.
    return defaultPath;
});

ipcMain.handle('backup:runNow', async () => {
    // Manual trigger for testing
    console.log('[Main] Manual backup triggered via IPC');
    await backupService.performBackup();
    return { success: true };
});

ipcMain.handle('backup:listSystemBackups', async () => {
    return backupService.listSystemBackups();
});

ipcMain.handle('auth:getRecoveryStatus', async () => {
    const userDataPath = app.getPath('userData');
    const { isSetup, hasRecovery } = securityService.isSetup(userDataPath);

    // If not setup, check for backups
    let hasBackups = false;
    let backups: any[] = [];

    if (!isSetup) {
        backups = await backupService.listSystemBackups();
        hasBackups = backups.length > 0;
    }

    return {
        isSetup,
        hasRecovery,
        hasBackups,
        backups
    };
});

ipcMain.handle('auth:restoreSystemBackup', async (_, backupPath) => {
    try {
        console.log('[Main] System Restore Triggered for:', backupPath);
        await backupService.restoreLocalBackup(backupPath);

        // After restore, we should probably restart the app to ensure clean state?
        // Or just return success and let the frontend reload?
        // Ideally, relaunch to reload DB connection fresh.
        app.relaunch();
        app.exit(0);

        return { success: true };
    } catch (e: any) {
        console.error('[Main] System Restore Failed:', e);
        return { success: false, error: e.message };
    }
});




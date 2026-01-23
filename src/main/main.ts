import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import { SecurityService } from './services/SecurityService';
import { DatabaseService } from './services/DatabaseService';
import { GoogleDriveService } from './services/GoogleDriveService';
import { ApiServer } from './server';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

let mainWindow: BrowserWindow | null = null;
const securityService = new SecurityService();
const databaseService = new DatabaseService();
const googleDriveService = new GoogleDriveService();
const apiServer = new ApiServer(databaseService);
apiServer.start();

let currentUser: any = null;

// Set explicit AppUserModelId for Windows
app.setAppUserModelId('com.sankarasabapathy.nalamdesk');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    process.exit(0); // Force exit immediately
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Create myWindow, load the rest of the app, etc...
    app.on('ready', createWindow);

    app.on('window-all-closed', () => {
        securityService.closeDb();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        }
    });
}

function createWindow() {
    // ... existing window creation ...
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../nalamdesk/browser/assets/icon.png'),
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#000000',
            height: 35
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // ... existing loadURL/loadFile ...
    // In test mode (Playwright), we want to load the static file (production behavior)
    // even if not packaged, to avoid needing 'ng serve' running.
    const isDev = !app.isPackaged && process.env['NODE_ENV'] !== 'test';
    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        // mainWindow.webContents.openDevTools();
    } else {
        // Load from internal server to avoid file:// protocol issues
        mainWindow.loadURL('http://localhost:3000');
    }

    // Auto Updater Events
    autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update-available', info);
    });

    autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('update-downloaded', info);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow?.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('error', (err) => {
        mainWindow?.webContents.send('update-error', err);
    });

    // Check for updates once window is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.focus(); // Ensure focus
        if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    });

    // ... existing on('closed') ...
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


// ... IPC Handlers ...

// Auto Updater IPC
ipcMain.handle('updater:check', () => {
    return autoUpdater.checkForUpdates();
});

ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
});






// IPC Handlers
ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        const { username, password } = credentials; // Expect object now
        let dbOpen = false;
        try {
            dbOpen = !!securityService.getDbPath();
        } catch { dbOpen = false; } // Check if DB is open checking path or similar

        // If Admin, try to unlock/init DB (if not open) or just validate
        if (username === 'admin') {
            // 1. Try to derive key and open DB if not open
            try {
                // Determine path
                const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
                const dbPath = app.isPackaged
                    ? path.join(app.getPath('userData'), dbName)
                    : path.join(__dirname, '../../', dbName);

                // If testing, we need to delete the DB to ensure fresh start - or maybe just use 'admin' password
                // For now, let's assume if it's test env, we just use it.

                const key = await securityService.deriveKey(password);
                try {
                    securityService.initDb(dbPath, key);
                    // If we are here, DB opened successfully with this password.
                    // We can safely update the admin password to ensure sync.
                    databaseService.setDb(securityService.getDb());
                    databaseService.migrate();
                    await databaseService.ensureAdminUser(password);
                } catch (e: any) {
                    if (e.message !== 'DB_ALREADY_OPEN') throw e;
                    // If DB already open, we skipped init.
                    // DO NOT update admin password here to prevent overwrite attacks.
                    // Just confirm we can access it.
                    databaseService.setDb(securityService.getDb());
                }


                // Initialize Server if not running
                // const apiServer = new ApiServer(databaseService); // Now started globally
                // apiServer.start();

                // Check Drive
                const settings = databaseService.getSettings();
                if (settings && settings.drive_tokens) {
                    googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
                }
            } catch (e: any) {
                console.error('DB Init failed:', e);
                return { success: false, error: 'INVALID_CREDENTIALS' };
            }
        } else {
            // Non-admin user
            // DB Must be open
            try {
                const db = securityService.getDb(); // Throws if not open
                databaseService.setDb(db); // Ensure Service has it
            } catch (e) {
                return { success: false, error: 'SYSTEM_LOCKED' };
            }
        }

        // 2. Now DB is open, validate user against table
        console.log(`[Auth] Validating user: ${username}`);
        const user = await databaseService.validateUser(username, password);
        console.log(`[Auth] Validation result:`, user ? 'Success' : 'Failed');
        if (user) {
            currentUser = user; // Store session
            return { success: true, user };
        } else {
            return { success: false, error: 'INVALID_CREDENTIALS' };
        }

    } catch (error: any) {
        console.error('Login failed:', error);
        return { success: false, error: 'UNKNOWN_ERROR' };
    }
});

// Database IPC Handlers
ipcMain.handle('db:getPatients', (_, query) => databaseService.getPatients(query));
ipcMain.handle('db:savePatient', (_, patient) => databaseService.savePatient(patient));
ipcMain.handle('db:deletePatient', (_, id) => databaseService.deletePatient(id));
ipcMain.handle('db:getVisits', (_, patientId) => databaseService.getVisits(patientId));
ipcMain.handle('db:getAllVisits', (_, limit) => databaseService.getAllVisits(limit));
ipcMain.handle('db:saveVisit', (_, visit) => databaseService.saveVisit(visit));
ipcMain.handle('db:deleteVisit', (_, id) => databaseService.deleteVisit(id));
ipcMain.handle('db:getSettings', () => databaseService.getSettings());
ipcMain.handle('db:saveSettings', (_, settings) => databaseService.saveSettings(settings));
ipcMain.handle('db:getDashboardStats', () => databaseService.getDashboardStats());
ipcMain.handle('db:getDoctors', () => databaseService.getDoctors());
ipcMain.handle('db:getVitals', (_, patientId) => databaseService.getVitals(patientId));
ipcMain.handle('db:saveVitals', (_, vitals) => databaseService.saveVitals(vitals));

// User Management IPC
ipcMain.handle('db:getUsers', () => databaseService.getUsers());
ipcMain.handle('db:saveUser', (_, user) => databaseService.saveUser(user));
ipcMain.handle('db:deleteUser', (_, id) => databaseService.deleteUser(id));

// Queue IPC Handlers
ipcMain.handle('db:getQueue', () => databaseService.getQueue());
ipcMain.handle('db:addToQueue', (_, { patientId, priority }) => {
    if (!currentUser) throw new Error('Unauthorized');
    return databaseService.addToQueue(patientId, priority, currentUser.id);
});
ipcMain.handle('db:updateQueueStatus', (_, { id, status }) => {
    if (!currentUser) throw new Error('Unauthorized');
    return databaseService.updateQueueStatus(id, status, currentUser.id);
});
ipcMain.handle('db:updateQueueStatusByPatientId', (_, { patientId, status }) => {
    if (!currentUser) throw new Error('Unauthorized');
    return databaseService.updateQueueStatusByPatientId(patientId, status, currentUser.id);
});
ipcMain.handle('db:removeFromQueue', (_, id) => {
    if (!currentUser) throw new Error('Unauthorized');
    return databaseService.removeFromQueue(id, currentUser.id);
});

// Audit IPC Handlers
ipcMain.handle('db:getAuditLogs', (_, limit) => databaseService.getAuditLogs(limit));

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




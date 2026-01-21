import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import { SecurityService } from './services/SecurityService';
import { DatabaseService } from './services/DatabaseService';
import { GoogleDriveService } from './services/GoogleDriveService';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

let mainWindow: BrowserWindow | null = null;
const securityService = new SecurityService();
const databaseService = new DatabaseService();
const googleDriveService = new GoogleDriveService();

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
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // ... existing loadURL/loadFile ...
    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../nalamdesk/browser/index.html'));
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

// IPC Handlers
ipcMain.handle('auth:login', async (event, password) => {
    try {
        const key = await securityService.deriveKey(password);
        // Defines where the user data DB is located.
        // In dev: project root/local_db.sqlite
        // In prod: app.getPath('userData')/nalamdesk.sqlite
        const dbName = 'nalamdesk.db';
        const dbPath = app.isPackaged
            ? path.join(app.getPath('userData'), dbName)
            : path.join(__dirname, '../../', dbName);

        securityService.initDb(dbPath, key);

        // Initialize Database Service with the open DB connection
        databaseService.setDb(securityService.getDb());
        databaseService.migrate();

        // Check for existing Drive tokens in settings
        const settings = databaseService.getSettings();
        if (settings && settings.drive_tokens) {
            googleDriveService.setCredentials(JSON.parse(settings.drive_tokens));
        }

        return { success: true };
    } catch (error: any) {
        console.error('Login failed:', error);
        if (error.message === 'INVALID_PASSWORD') {
            return { success: false, error: 'INVALID_PASSWORD' };
        }
        return { success: false, error: 'UNKNOWN_ERROR' };
    }
});

// Database IPC Handlers
ipcMain.handle('db:getPatients', (_, query) => databaseService.getPatients(query));
ipcMain.handle('db:savePatient', (_, patient) => databaseService.savePatient(patient));
ipcMain.handle('db:deletePatient', (_, id) => databaseService.deletePatient(id));
ipcMain.handle('db:getVisits', (_, patientId) => databaseService.getVisits(patientId));
ipcMain.handle('db:saveVisit', (_, visit) => databaseService.saveVisit(visit));
ipcMain.handle('db:deleteVisit', (_, id) => databaseService.deleteVisit(id));
ipcMain.handle('db:getSettings', () => databaseService.getSettings());
ipcMain.handle('db:saveSettings', (_, settings) => databaseService.saveSettings(settings));
ipcMain.handle('db:getDashboardStats', () => databaseService.getDashboardStats());
ipcMain.handle('db:getDoctors', () => databaseService.getDoctors());
ipcMain.handle('db:saveDoctor', (_, doctor) => databaseService.saveDoctor(doctor));
ipcMain.handle('db:deleteDoctor', (_, id) => databaseService.deleteDoctor(id));

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




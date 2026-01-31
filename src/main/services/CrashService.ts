import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

export class CrashService {
    constructor() {
        this.setupHandlers();
    }

    private setupHandlers() {
        // Main Process Crashes
        process.on('uncaughtException', (error: any) => {
            log.error('Uncaught Exception:', error);
            this.handleCrash(error, 'Main Process');
        });

        process.on('unhandledRejection', (reason: any) => {
            log.error('Unhandled Rejection:', reason);
            this.handleCrash(reason, 'Main Process (Promise)');
        });

        // Renderer Crashes (handled via app events)
        app.on('render-process-gone', (event, webContents, details) => {
            log.error('Renderer Process Gone:', details);
            if (details.reason !== 'clean-exit') {
                this.handleCrash(new Error(`Renderer crashed: ${details.reason}`), 'Renderer Process');
            }
        });

        app.on('child-process-gone', (event, details) => {
            log.error('Child Process Gone:', details);
            if (details.type !== 'Utility') { // Utility processes might exit normally
                // Only alert on critical child processes if needed
            }
        });
    }

    private async handleCrash(error: any, context: string) {
        const report = this.generateReport(error, context);

        // Show Dialog
        const { response } = await dialog.showMessageBox({
            type: 'error',
            title: 'Application Error',
            message: `The application encountered a critical error in ${context}.`,
            detail: 'Would you like to save an anonymous crash report to share with support?',
            buttons: ['Save Report', 'Ignore', 'Restart App'],
            defaultId: 0,
            cancelId: 1
        }) as any;

        if (response === 0) { // Save Report
            this.saveReport(report);
        } else if (response === 2) { // Restart
            app.relaunch();
            app.exit(0);
        }
    }

    private generateReport(error: any, context: string) {
        const stack = error?.stack || String(error);
        const cleanStack = this.sanitize(stack);

        return {
            timestamp: new Date().toISOString(),
            appVersion: app.getVersion(),
            os: process.platform,
            arch: process.arch,
            context,
            error: error?.message || String(error),
            stack: cleanStack,
            logs: this.getLastLogs()
        };
    }

    // Strip PII (like /Users/username/...)
    private sanitize(text: string): string {
        const homeDir = app.getPath('home').replace(/\\/g, '/');
        const regex = new RegExp(this.escapeRegExp(homeDir), 'gi'); // Case insensitive
        return text.replace(/\\/g, '/').replace(regex, '$HOME');
    }

    private escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private getLastLogs() {
        // With electron-log, logs are in a file. 
        // We might just reference the file path or try to read the last 50 lines.
        // For simplicity/safety on crash, let's just point to the log file location in the report
        return `See logs at: ${log.transports.file.getFile().path}`;
    }

    private async saveReport(report: any) {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Crash Report',
            defaultPath: `nalamdesk-crash-report-${Date.now()}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        }) as any;

        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
            dialog.showMessageBox({
                message: 'Report saved. Please email this file to support.',
                type: 'info'
            });
        }
    }
}

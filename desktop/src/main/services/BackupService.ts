import { CronJob } from 'cron';
import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { SecurityService } from './SecurityService';
import * as fs from 'fs';
import * as path from 'path';

export class BackupService {
    private localJob: CronJob | null = null;
    private cloudJob: CronJob | null = null;
    private localBackupPath: string = '';

    constructor(
        private dbService: DatabaseService,
        private driveService: GoogleDriveService,
        private securityService: SecurityService,
        private userDataPath: string
    ) {
        // Default to 'backups' folder in AppData
        this.localBackupPath = path.join(this.userDataPath, 'backups');
    }

    setLocalBackupPath(path: string) {
        this.localBackupPath = path;
    }

    initAutomatedBackup() {
        const settings = this.dbService.getSettings();
        const localTime = settings?.backup_schedule || '13:00';
        const cloudTime = settings?.cloud_backup_schedule || '13:00';

        console.log(`[Backup] Initializing schedules - Local: ${localTime}, Cloud: ${cloudTime}`);
        this.scheduleLocalBackup(localTime);
        this.scheduleCloudBackup(cloudTime);
    }

    private convertToCron(time: string): string {
        // If it looks like HH:MM, convert to cron. Otherwise return as is.
        if (/^\d{2}:\d{2}$/.test(time)) {
            const [hours, minutes] = time.split(':');
            return `0 ${minutes} ${hours} * * *`;
        }
        return time; // Assume valid cron or default
    }

    scheduleLocalBackup(time: string) {
        if (this.localJob) this.localJob.stop();
        try {
            const cronTime = this.convertToCron(time);
            console.log(`[Backup] Scheduling LOCAL backup for ${cronTime}`);
            this.localJob = new CronJob(cronTime, () => this.performLocalBackup());
            this.localJob.start();
        } catch (e) {
            console.error('[Backup] Failed to schedule local backup:', e);
        }
    }

    scheduleCloudBackup(time: string) {
        if (this.cloudJob) this.cloudJob.stop();
        try {
            const cronTime = this.convertToCron(time);
            console.log(`[Backup] Scheduling CLOUD backup for ${cronTime}`);
            this.cloudJob = new CronJob(cronTime, () => this.performCloudBackup());
            this.cloudJob.start();
        } catch (e) {
            console.error('[Backup] Failed to schedule cloud backup:', e);
        }
    }


    updateSchedule(type: 'local' | 'cloud', time: string) {
        if (type === 'local') this.scheduleLocalBackup(time);
        else if (type === 'cloud') this.scheduleCloudBackup(time);
    }

    async performBackupOnQuit() {
        console.log('[Backup] Performing backup on quit...');
        try {
            await this.performLocalBackup();
            if (this.driveService.isAuthenticated()) {
                await this.performCloudBackup();
            }
        } catch (e) {
            console.error('[Backup] Backup on quit failed', e);
        }
    }

    async performBackup() {
        // ... (lines 45-59 unchanged, implied for context if needed, but I'm replacing scheduleDailyBackup and performLocalBackup header)
        console.log('[Backup] Starting automated backup sequence...');
        if (this.localBackupPath) {
            await this.performLocalBackup();
        } else {
            console.warn('[Backup] Local backup skipped: No path configured.');
        }

        if (this.driveService.isAuthenticated()) {
            await this.performCloudBackup();
        }
    }

    private async performLocalBackup() {
        try {
            if (!fs.existsSync(this.localBackupPath)) {
                fs.mkdirSync(this.localBackupPath, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `nalamdesk-auto-backup-${timestamp}.db`;
            const destPath = path.join(this.localBackupPath, fileName);

            console.log(`[Backup] Creating local backup: ${destPath}`);
            await this.dbService.backupDatabase(destPath);

            // Prune old backups
            this.pruneLocalBackups();

            this.dbService.logAudit('BACKUP_LOCAL', 'system', 0, 0, `Created local backup: ${fileName}`);
        } catch (e: any) {
            console.error('[Backup] Local backup failed:', e);
            this.dbService.logAudit('BACKUP_ERROR', 'system', 0, 0, `Local backup failed: ${e.message}`);
        }
    }

    private pruneLocalBackups() {
        try {
            const retentionDays = 30;
            const now = Date.now();
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

            const files = fs.readdirSync(this.localBackupPath);
            let deletedCount = 0;

            for (const file of files) {
                if (!file.startsWith('nalamdesk-auto-backup-') || !file.endsWith('.db')) continue;

                const filePath = path.join(this.localBackupPath, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtimeMs > retentionMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`[Backup] Pruned ${deletedCount} old backup(s).`);
            }
        } catch (e) {
            console.error('[Backup] Failed to prune old backups:', e);
        }
    }

    private async performCloudBackup() {
        try {
            const dbPath = this.securityService.getDbPath();
            if (!dbPath || !fs.existsSync(dbPath)) {
                console.error('[Backup] Cloud backup skipped: DB file access error.');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `nalamdesk-cloud-backup-${timestamp}.db`;

            console.log(`[Backup] Uploading to Google Drive: ${fileName}`);
            await this.driveService.uploadFile(dbPath, fileName);
            console.log(`[Backup] Cloud upload success: ${fileName}`);

            this.dbService.logAudit('BACKUP_CLOUD', 'system', 0, 0, `Uploaded cloud backup: ${fileName}`);
        } catch (e: any) {
            console.error('[Backup] Cloud backup failed:', e);
            this.dbService.logAudit('BACKUP_ERROR', 'system', 0, 0, `Cloud backup failed: ${e.message}`);
        }
    }
    async listSystemBackups(): Promise<any[]> {
        try {
            if (!fs.existsSync(this.localBackupPath)) return [];

            const files = fs.readdirSync(this.localBackupPath)
                .filter(f => f.endsWith('.db') && f.includes('backup'))
                .map(f => {
                    const filePath = path.join(this.localBackupPath, f);
                    const stats = fs.statSync(filePath);
                    return {
                        name: f,
                        path: filePath,
                        createdTime: stats.mtime,
                        size: stats.size
                    };
                })
                .sort((a, b) => b.createdTime.getTime() - a.createdTime.getTime());

            return files;
        } catch (e) {
            console.error('[Backup] Failed to list system backups:', e);
            return [];
        }
    }

    async restoreLocalBackup(backupFilePath: string): Promise<boolean> {
        try {
            if (!fs.existsSync(backupFilePath)) {
                throw new Error('Backup file not found');
            }

            console.log(`[Backup] Restoring from local backup: ${backupFilePath}`);

            // 1. Close current DB connection
            this.securityService.closeDb();

            // 2. Determine Target DB Path
            // If DB was open, we use that path. If not, we construct default path.
            let targetPath = this.securityService.getDbPath();
            if (!targetPath) {
                // Fallback to default path logic (similar to main.ts)
                const dbName = process.env['NODE_ENV'] === 'test' ? 'nalamdesk-test.db' : 'nalamdesk.db';
                // We need to know if packaged or not, but usually this service runs in Main which knows.
                // However, securityService usually has the path if initialized.
                // If not initialized (Setup Screen), we assume default userdata path.
                targetPath = path.join(this.userDataPath, dbName);
            }

            console.log(`[Backup] Target DB Path: ${targetPath}`);

            // 3. Copy Backup to Target
            fs.copyFileSync(backupFilePath, targetPath);

            console.log('[Backup] Restore successful.');
            return true;
        } catch (e) {
            console.error('[Backup] Restore failed:', e);
            throw e;
        }
    }
}

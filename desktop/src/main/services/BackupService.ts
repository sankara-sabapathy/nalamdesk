import { CronJob } from 'cron';
import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { SecurityService } from './SecurityService';
import * as fs from 'fs';

export class BackupService {
    private job: CronJob | null = null;

    constructor(
        private dbService: DatabaseService,
        private driveService: GoogleDriveService,
        private securityService: SecurityService
    ) { }

    scheduleDailyBackup(cronTime: string = '0 22 * * *') { // Default: 10:00 PM
        if (this.job) {
            this.job.stop();
        }

        try {
            console.log(`[Backup] Scheduling daily backup for ${cronTime}`);
            this.job = new CronJob(cronTime, () => {
                this.performBackup();
            });
            this.job.start();
        } catch (e) {
            console.error('[Backup] Failed to schedule backup:', e);
        }
    }

    async performBackup() {
        console.log('[Backup] Starting automated backup...');
        try {
            // Check if Drive is authenticated
            if (!this.driveService.isAuthenticated()) {
                console.log('[Backup] Skipped: Google Drive not authenticated.');
                return;
            }

            const dbPath = this.securityService.getDbPath();
            if (!dbPath) {
                console.error('[Backup] Skipped: Database path not found (is it open?).');
                return;
            }
            // Check if file actually exists on disk
            if (!fs.existsSync(dbPath)) {
                console.error('[Backup] Skipped: Database file missing.');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `nalamdesk-auto-backup-${timestamp}.db`;

            // Upload
            await this.driveService.uploadFile(dbPath, fileName);
            console.log(`[Backup] Success! Uploaded ${fileName}`);

            // Optional: Log to Audit
            // this.dbService.logAudit('BACKUP', 'system', 0, 0, `Automated backup: ${fileName}`);

        } catch (e) {
            console.error('[Backup] Failed:', e);
        }
    }
}

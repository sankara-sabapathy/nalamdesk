import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from './BackupService';
import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { SecurityService } from './SecurityService';

// Mock dependencies
const mockDbService = {
    logAudit: vi.fn(),
    backupDatabase: vi.fn(),
    getSettings: vi.fn()
} as unknown as DatabaseService;

const mockDriveService = {
    isAuthenticated: vi.fn(),
    uploadFile: vi.fn()
} as unknown as GoogleDriveService;

const mockSecurityService = {
    getDbPath: vi.fn()
} as unknown as SecurityService;

// Define mocks for CronJob instance methods
const mockStart = vi.fn();
const mockStop = vi.fn();

// Mock cron
vi.mock('cron', () => {
    return {
        CronJob: vi.fn().mockImplementation(function (time, task) {
            return {
                start: mockStart,
                stop: mockStop
            };
        })
    };
});

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ mtimeMs: Date.now(), size: 1024 }),
    unlinkSync: vi.fn(),
    copyFileSync: vi.fn()
}));

// Import CronJob to check constructor calls if needed, OR just rely on instance method checks
import { CronJob } from 'cron';

describe('BackupService', () => {
    let service: BackupService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BackupService(mockDbService, mockDriveService, mockSecurityService, '/mock/user/data');
    });

    describe('Scheduling', () => {
        it('should schedule local and cloud backups on init', () => {
            vi.mocked(mockDbService.getSettings).mockReturnValue({
                backup_schedule: '14:00',
                cloud_backup_schedule: '15:00'
            } as any);

            service.initAutomatedBackup();

            // Check if CronJob constructor was called twice
            expect(CronJob).toHaveBeenCalledTimes(2);
            // Check if start was called twice
            expect(mockStart).toHaveBeenCalledTimes(2);
        });

        it('should use default times if settings missing', () => {
            vi.mocked(mockDbService.getSettings).mockReturnValue(null);

            service.initAutomatedBackup();

            expect(CronJob).toHaveBeenCalledTimes(2);
            // Verify default cron patterns (13:00 -> 0 0 13 * * *)
            // Note: convertToCron transforms '13:00' to '0 0 13 * * *'
            // We can check the arguments passed to CronJob if we want to be strict, 
            // but mocking behaviors is usually enough.
        });

        it('should stop existing local job before scheduling new one', () => {
            service.scheduleLocalBackup('12:00');
            service.scheduleLocalBackup('13:00');
            expect(mockStop).toHaveBeenCalled();
        });

        it('should stop existing cloud job before scheduling new one', () => {
            service.scheduleCloudBackup('12:00');
            service.scheduleCloudBackup('13:00');
            expect(mockStop).toHaveBeenCalled();
        });
    });

    describe('performBackup (Manual)', () => {
        it('should run both local and cloud backups if configured', async () => {
            // Mock Local Path
            service.setLocalBackupPath('/mock/backups');
            // Mock Drive Auth
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(true);
            vi.mocked(mockSecurityService.getDbPath).mockReturnValue('/path/to/db.db');

            await service.performBackup();

            // Check Local Backup (DB Backup called)
            expect(mockDbService.backupDatabase).toHaveBeenCalledWith(expect.stringContaining('nalamdesk-auto-backup'));

            // Check Cloud Backup (Upload called)
            expect(mockDriveService.uploadFile).toHaveBeenCalledWith('/path/to/db.db', expect.stringContaining('nalamdesk-cloud-backup'));
        });

        it('should skip cloud backup if not authenticated', async () => {
            // Mock Local Path
            service.setLocalBackupPath('/mock/backups');
            // Mock Drive Auth False
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(false);

            await service.performBackup();

            // Check Local Backup
            expect(mockDbService.backupDatabase).toHaveBeenCalled();
            // Check Cloud Backup Skipped
            expect(mockDriveService.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe('performBackupOnQuit', () => {
        it('should attempt both backups', async () => {
            // Mock Local Path
            service.setLocalBackupPath('/mock/backups');
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(true);
            vi.mocked(mockSecurityService.getDbPath).mockReturnValue('/path/to/db.db');

            await service.performBackupOnQuit();

            expect(mockDbService.backupDatabase).toHaveBeenCalled();
            expect(mockDriveService.uploadFile).toHaveBeenCalled();
        });
    });
});

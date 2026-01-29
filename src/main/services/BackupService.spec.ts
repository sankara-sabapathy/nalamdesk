import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupService } from './BackupService';
import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { SecurityService } from './SecurityService';

// Mock dependencies
const mockDbService = {
    logAudit: vi.fn()
} as unknown as DatabaseService;

const mockDriveService = {
    isAuthenticated: vi.fn(),
    uploadFile: vi.fn()
} as unknown as GoogleDriveService;

const mockSecurityService = {
    getDbPath: vi.fn()
} as unknown as SecurityService;

const { mockCronJob } = vi.hoisted(() => {
    return {
        mockCronJob: {
            start: vi.fn(() => console.log('[Test] mockCronJob.start called')),
            stop: vi.fn(() => console.log('[Test] mockCronJob.stop called')),
            _task: null // To verify callback
        }
    };
});

vi.mock('cron', () => ({
    CronJob: vi.fn().mockImplementation((time, task) => {
        console.log('[Test] CronJob constructor called');
        // Expose task to test it
        (mockCronJob as any)._task = task;
        return mockCronJob;
    })
}));

describe('BackupService', () => {
    let service: BackupService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BackupService(mockDbService, mockDriveService, mockSecurityService);
    });

    it('should schedule a daily backup', () => {
        service.scheduleDailyBackup();
        expect(mockCronJob.start).toHaveBeenCalled();
    });

    it('should stop existing job before scheduling new one', () => {
        service.scheduleDailyBackup();
        service.scheduleDailyBackup();
        expect(mockCronJob.stop).toHaveBeenCalled();
    });

    describe('performBackup', () => {
        it('should perform backup if authenticated and path exists', async () => {
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(true);
            vi.mocked(mockSecurityService.getDbPath).mockReturnValue('/path/to/db.db');

            await service.performBackup();

            expect(mockDriveService.uploadFile).toHaveBeenCalledWith('/path/to/db.db', expect.stringContaining('nalamdesk-auto-backup'));
        });

        it('should skip if not authenticated', async () => {
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(false);
            await service.performBackup();
            expect(mockDriveService.uploadFile).not.toHaveBeenCalled();
        });

        it('should skip if db path not found', async () => {
            vi.mocked(mockDriveService.isAuthenticated).mockReturnValue(true);
            vi.mocked(mockSecurityService.getDbPath).mockReturnValue(null);
            await service.performBackup();
            expect(mockDriveService.uploadFile).not.toHaveBeenCalled();
        });
    });
});

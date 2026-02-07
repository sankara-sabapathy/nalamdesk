import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    existsSync: vi.fn().mockReturnValue(true) // Default to true for tests
}));

// Import CronJob to check constructor calls if needed, OR just rely on instance method checks
import { CronJob } from 'cron';

describe('BackupService', () => {
    let service: BackupService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BackupService(mockDbService, mockDriveService, mockSecurityService, '/mock/user/data');
    });

    it('should schedule a daily backup', () => {
        service.scheduleDailyBackup();
        // Check if constructor was called
        expect(CronJob).toHaveBeenCalled();
        // Check if start was called
        expect(mockStart).toHaveBeenCalled();
    });

    it('should stop existing job before scheduling new one', () => {
        service.scheduleDailyBackup();
        service.scheduleDailyBackup();
        expect(mockStop).toHaveBeenCalled();
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

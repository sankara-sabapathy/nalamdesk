import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrashService } from './CrashService';

// Mock Electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/home'),
        getVersion: vi.fn().mockReturnValue('1.0.0'),
        relaunch: vi.fn(),
        exit: vi.fn(),
        on: vi.fn() // For process listeners
    },
    dialog: {
        showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
        showSaveDialog: vi.fn().mockResolvedValue({ filePath: '/mock/save/report.json' })
    }
}));

// Mock electron-log
vi.mock('electron-log', () => ({
    default: {
        error: vi.fn(),
        transports: {
            file: {
                getFile: vi.fn().mockReturnValue({ path: '/mock/log.log' })
            }
        }
    }
}));

// Mock FS
vi.mock('fs', () => ({
    writeFileSync: vi.fn()
}));

describe('CrashService', () => {
    let service: CrashService;
    let processOnSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Spy on process.on to capture handlers if we wanted to trigger them
        processOnSpy = vi.spyOn(process, 'on');
        service = new CrashService();
    });

    it('should register error handlers on instantiation', () => {
        expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    // It's hard to test the private handleCrash method without using 'any' casting or exporting it.
    // For now, checking instantiation covers basic "it compiles and hooks up" logic.
    // To properly test the flow, we'd need to emit the events.

    it('should use sanitize PII from home directory', () => {
        // Access private method via casting to test logic
        const sanitized = (service as any).sanitize('/mock/home/documents/secret.txt');
        expect(sanitized).toBe('$HOME/documents/secret.txt');
    });
});

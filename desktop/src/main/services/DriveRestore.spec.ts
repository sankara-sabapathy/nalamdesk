import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './DatabaseService';
import { RestoreOperationGate } from './RestoreOperationGate';
import { runDriveRestore } from './DriveRestore';

describe('runDriveRestore', () => {
    function setup() {
        const gate = new RestoreOperationGate();
        const dbService = new DatabaseService();
        const closeDb = vi.fn();
        const downloadFile = vi.fn(async () => undefined);
        const onCommitted = vi.fn();
        const restore = (overrides: Partial<Parameters<typeof runDriveRestore>[0]> = {}) => runDriveRestore({
            gate, dbService, getDbPath: () => '/tmp/nalamdesk.db', closeDb, downloadFile,
            fileId: 'drive-file', onCommitted, ...overrides
        });
        return { gate, dbService, closeDb, downloadFile, onCommitted, restore };
    }

    it('rejects an overlapping local restore or second Drive restore with RESTORE_IN_PROGRESS', async () => {
        const { gate, dbService, closeDb, downloadFile, restore } = setup();
        let finishLocal!: () => void;
        const localRestore = gate.run(() => new Promise<void>(resolve => { finishLocal = resolve; }));
        await expect(restore()).rejects.toThrow('RESTORE_IN_PROGRESS');
        expect(closeDb).not.toHaveBeenCalled();
        expect(downloadFile).not.toHaveBeenCalled();
        expect(() => dbService.beginWork()).not.toThrow();
        dbService.endWork();
        finishLocal();
        await localRestore;
        await expect(restore()).rejects.toThrow('RESTORE_IN_PROGRESS');
    });

    it('fences before closeDb and stays fenced after a successful overwrite', async () => {
        const { dbService, closeDb, downloadFile, onCommitted, restore } = setup();
        const order: string[] = [];
        const fence = dbService.fence.bind(dbService);
        dbService.fence = async (timeoutMs?: number) => { order.push('fence'); await fence(timeoutMs); };
        closeDb.mockImplementation(() => order.push('close'));
        downloadFile.mockImplementation(async () => { order.push('download'); });
        await expect(restore()).resolves.toEqual({ success: true, restartRequired: true });
        expect(order).toEqual(['fence', 'close', 'download']);
        expect(onCommitted).toHaveBeenCalledOnce();
        expect(() => dbService.beginWork()).toThrow('RESTORE_IN_PROGRESS');
        await expect(restore()).rejects.toThrow('RESTORE_IN_PROGRESS');
    });

    it('unfences immediately when the drain times out before close', async () => {
        const { dbService, closeDb, downloadFile, restore } = setup();
        dbService.beginWork();
        await expect(restore({ drainTimeoutMs: 20 })).rejects.toThrow('RESTORE_DRAIN_TIMEOUT');
        expect(closeDb).not.toHaveBeenCalled();
        expect(downloadFile).not.toHaveBeenCalled();
        dbService.endWork();
        expect(() => { dbService.beginWork(); dbService.endWork(); }).not.toThrow();
    });

    it('stays fenced when download fails after closeDb', async () => {
        const { dbService, closeDb, restore } = setup();
        await expect(restore({
            downloadFile: async () => { throw new Error('DOWNLOAD_FAILED'); }
        })).rejects.toThrow('DOWNLOAD_FAILED');
        expect(closeDb).toHaveBeenCalledOnce();
        expect(() => dbService.beginWork()).toThrow('RESTORE_IN_PROGRESS');
    });
});

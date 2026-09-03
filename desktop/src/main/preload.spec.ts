import { beforeAll, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
    exposeInMainWorld: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn()
}));

vi.mock('electron', () => ({
    contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
    ipcRenderer: { invoke: electron.invoke, on: electron.on }
}));

describe('preload bridge surface', () => {
    let api: any;

    beforeAll(async () => {
        await import('./preload');
        expect(electron.exposeInMainWorld).toHaveBeenCalledOnce();
        api = electron.exposeInMainWorld.mock.calls[0][1];
    });

    it('exposes picker-based backup restore without raw filesystem access', async () => {
        expect(api.fs).toBeUndefined();
        expect(api.backup.readFile).toBeUndefined();
        await api.backup.selectRestoreBundle();
        expect(electron.invoke).toHaveBeenCalledWith('backup:selectRestoreBundle');
    });

    it('sends queue writes with the renderer object payload Electron IPC unpacks', async () => {
        await api.db.addToQueue({ patientId: 42, priority: 2 });
        await api.db.updateQueueStatus({ id: 9, status: 'waiting' });
        await api.db.removeFromQueue(9);
        expect(electron.invoke).toHaveBeenCalledWith('db:addToQueue', { patientId: 42, priority: 2 });
        expect(electron.invoke).toHaveBeenCalledWith('db:updateQueueStatus', { id: 9, status: 'waiting' });
        expect(electron.invoke).toHaveBeenCalledWith('db:removeFromQueue', 9);
    });
});

import { describe, expect, it, vi } from 'vitest';
import { SetupComponent } from './setup.component';

function component() {
    return new SetupComponent({} as any, {} as any, { run: (fn: () => void) => fn() } as any);
}

describe('SetupComponent external backup selection', () => {
    it('leaves setup unchanged when the sandboxed picker is cancelled', async () => {
        (window as any).electron = { backup: { selectRestoreBundle: vi.fn(async () => null) } };
        const value = component();
        await value.selectExternalBackup();
        expect(value.hasBackups).toBe(false);
        expect(value.localBackups).toEqual([]);
    });

    it('adds an external recoverable bundle without exposing raw filesystem APIs', async () => {
        (window as any).electron = { backup: { selectRestoreBundle: vi.fn(async () => ({
            path: '/external/clinic.ndbackup', name: 'clinic.ndbackup'
        })) } };
        const value = component();
        await value.selectExternalBackup();
        expect(value.hasBackups).toBe(true);
        expect(value.localBackups[0]).toMatchObject({ name: 'clinic.ndbackup', recoverable: true });
        expect((window as any).electron.fs).toBeUndefined();
        expect((window as any).electron.backup.readFile).toBeUndefined();
    });

    it('labels a selected legacy DB as non-recoverable', async () => {
        (window as any).electron = { backup: { selectRestoreBundle: vi.fn(async () => ({
            path: '/external/old.db', name: 'old.db'
        })) } };
        const value = component();
        await value.selectExternalBackup();
        expect(value.localBackups[0]).toMatchObject({ format: 'legacy-database-only', recoverable: false });
        expect(value.restoreError).toContain('legacy backup');
    });
});

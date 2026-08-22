import { describe, expect, it, vi } from 'vitest';
import { selectRestoreBundle } from './BackupFileSelection';

describe('selectRestoreBundle', () => {
    it('returns null when the sandboxed picker is cancelled', async () => {
        await expect(selectRestoreBundle(vi.fn(async () => ({ canceled: true, filePaths: [] })))).resolves.toBeNull();
    });

    it('returns only the selected path and display name for a supported bundle', async () => {
        await expect(selectRestoreBundle(vi.fn(async () => ({
            canceled: false, filePaths: ['/external/clinic.ndbackup']
        })))).resolves.toEqual({ path: '/external/clinic.ndbackup', name: 'clinic.ndbackup' });
    });

    it('allows legacy DB selection so restore can report its precise limitation', async () => {
        await expect(selectRestoreBundle(vi.fn(async () => ({
            canceled: false, filePaths: ['/external/old.db']
        })))).resolves.toEqual({ path: '/external/old.db', name: 'old.db' });
    });

    it('rejects a path outside the file types enforced by the dialog', async () => {
        await expect(selectRestoreBundle(vi.fn(async () => ({
            canceled: false, filePaths: ['/external/not-a-backup.txt']
        })))).rejects.toThrow('UNSUPPORTED_BACKUP_FILE');
    });
});

import { describe, expect, it, vi } from 'vitest';
import { ProvisioningService } from './ProvisioningService';

describe('ProvisioningService', () => {
    it.each(['migration', 'settings', 'admin'] as const)(
        'aborts the durable fresh provisioning transaction when %s fails',
        async failure => {
            const security = {
                setup: vi.fn().mockResolvedValue('RECOVERY'),
                getDb: vi.fn().mockReturnValue({}),
                completeProvisioning: vi.fn(),
                abortProvisioning: vi.fn()
            };
            const database = {
                setDb: vi.fn(),
                migrate: failure === 'migration'
                    ? vi.fn().mockRejectedValue(new Error('migration failed'))
                    : vi.fn().mockResolvedValue(undefined),
                saveSettings: failure === 'settings'
                    ? vi.fn(() => { throw new Error('settings failed'); })
                    : vi.fn(),
                ensureAdminUser: failure === 'admin'
                    ? vi.fn().mockRejectedValue(new Error('admin failed'))
                    : vi.fn().mockResolvedValue(undefined)
            };

            await expect(new ProvisioningService(security, database).provision(
                'admin-password', {}, '/db', '/data'
            )).rejects.toThrow(`${failure} failed`);
            expect(security.abortProvisioning).toHaveBeenCalledOnce();
            expect(security.completeProvisioning).not.toHaveBeenCalled();
        }
    );

    it('commits only after schema, settings, and administrator creation succeed', async () => {
        const calls: string[] = [];
        const security = {
            setup: vi.fn(async () => { calls.push('setup'); return 'RECOVERY'; }),
            getDb: vi.fn(() => ({})),
            completeProvisioning: vi.fn(() => calls.push('complete')),
            abortProvisioning: vi.fn()
        };
        const database = {
            setDb: vi.fn(() => calls.push('set-db')),
            migrate: vi.fn(async () => { calls.push('migrate'); }),
            saveSettings: vi.fn(() => calls.push('settings')),
            ensureAdminUser: vi.fn(async () => { calls.push('admin'); })
        };
        await expect(new ProvisioningService(security, database).provision(
            'admin-password', {}, '/db', '/data'
        )).resolves.toBe('RECOVERY');
        expect(calls).toEqual(['setup', 'set-db', 'migrate', 'settings', 'admin', 'complete']);
        expect(database.migrate).toHaveBeenCalledWith({ skipBackup: true });
        expect(security.abortProvisioning).not.toHaveBeenCalled();
    });
});

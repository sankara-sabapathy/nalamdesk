import { describe, expect, it, vi } from 'vitest';
import { requireExistingRestoreAuthorization } from './RestoreAuthorization';

const active = { id: 1, username: 'admin', role: 'admin', active: 1, password: 'persisted-hash' };
const session = { id: 1, username: 'admin', role: 'admin' };

describe('restore authorization', () => {
    it('allows a truly clean machine to recover with the bundle recovery code alone', async () => {
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: false, hasConfig: false, databaseOpen: false,
            sessionUser: null, persistedAdmin: null
        })).resolves.toBeUndefined();
    });

    it('fails closed for an incomplete or locked existing vault', async () => {
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: true, hasConfig: false, databaseOpen: false,
            sessionUser: null, persistedAdmin: null
        })).rejects.toThrow('LIVE_VAULT_INCOMPLETE');
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: true, hasConfig: true, databaseOpen: false,
            sessionUser: session, persistedAdmin: active, currentAdminPassword: 'fresh'
        })).rejects.toThrow('LIVE_VAULT_RECOVERY_REQUIRED');
    });

    it.each([
        ['cached admin whose persisted account is inactive', session, { ...active, active: 0 }],
        ['stale session for a replaced admin row', session, { ...active, id: 2 }],
        ['non-admin session', { ...session, role: 'doctor' }, active]
    ])('rejects a %s', async (_label, sessionUser, persistedAdmin) => {
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: true, hasConfig: true, databaseOpen: true,
            sessionUser, persistedAdmin, currentAdminPassword: 'fresh'
        }, vi.fn(async () => true))).rejects.toThrow('RESTORE_ADMIN_AUTHORIZATION_REQUIRED');
    });

    it('requires a fresh password verification against the persisted active admin', async () => {
        const verify = vi.fn(async (_hash: string, password: string) => password === 'fresh');
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: true, hasConfig: true, databaseOpen: true,
            sessionUser: session, persistedAdmin: active, currentAdminPassword: 'stale'
        }, verify)).rejects.toThrow('INVALID_ADMIN_CREDENTIAL');
        await expect(requireExistingRestoreAuthorization({
            hasDatabase: true, hasConfig: true, databaseOpen: true,
            sessionUser: session, persistedAdmin: active, currentAdminPassword: 'fresh'
        }, verify)).resolves.toBeUndefined();
        expect(verify).toHaveBeenLastCalledWith('persisted-hash', 'fresh');
    });
});

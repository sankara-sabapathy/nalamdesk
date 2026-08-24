import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { isPersistedActiveAdminSession, verifyPersistedActiveAdmin } from './AdminCredentialVerifier';

vi.mock('argon2', () => ({
    verify: vi.fn(async (hash: string, password: string) => hash === 'admin-hash' && password === 'current')
}));

describe('verifyPersistedActiveAdmin', () => {
    const session = { id: 1, username: 'admin', role: 'admin', name: 'Administrator' } as any;
    let persisted: any;
    let database: any;

    beforeEach(() => {
        vi.clearAllMocks();
        persisted = { id: 1, username: 'admin', role: 'admin', active: 1, password: 'admin-hash' };
        database = { getUserByUsername: vi.fn(() => persisted) };
    });

    it('accepts only a matching persisted active administrator with the current password', async () => {
        await expect(verifyPersistedActiveAdmin(session, database, 'current')).resolves.toBe(true);
        expect(argon2.verify).toHaveBeenCalledWith('admin-hash', 'current');
    });

    it.each([
        ['demoted', { role: 'doctor' }],
        ['deactivated', { active: 0 }],
        ['id mismatch', { id: 99 }],
        ['username mismatch', { username: 'other-admin' }]
    ])('rejects a stale session when the persisted administrator is %s', async (_label, change) => {
        persisted = { ...persisted, ...change };
        expect(isPersistedActiveAdminSession(session, database)).toBe(false);
        await expect(verifyPersistedActiveAdmin(session, database, 'current')).resolves.toBe(false);
        expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('rejects an invalid current password and malformed password hashes', async () => {
        await expect(verifyPersistedActiveAdmin(session, database, 'wrong')).resolves.toBe(false);
        vi.mocked(argon2.verify).mockRejectedValueOnce(new Error('malformed hash'));
        await expect(verifyPersistedActiveAdmin(session, database, 'current')).resolves.toBe(false);
    });
});

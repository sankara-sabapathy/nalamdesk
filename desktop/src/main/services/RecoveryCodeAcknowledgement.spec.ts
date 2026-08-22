import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeRecoveryCodeForActiveAdmin } from './RecoveryCodeAcknowledgement';

describe('acknowledgeRecoveryCodeForActiveAdmin', () => {
    const session = { id: 1, username: 'admin', role: 'admin', name: 'Administrator' } as any;
    const exactCode = 'AAAA-BBBB-CCCC-DDDD';
    let persisted: any;
    let database: any;
    let state: { recovery: string; pending: string | null };
    let security: any;

    beforeEach(() => {
        persisted = { id: 1, username: 'admin', role: 'admin', active: 1, password: 'hash' };
        database = { getUserByUsername: vi.fn(() => persisted) };
        state = { recovery: 'old-envelope', pending: exactCode };
        security = {
            acknowledgePendingRecoveryCode: vi.fn((code: string) => {
                if (code !== state.pending) throw new Error('INVALID_RECOVERY_ACK');
                state = { recovery: 'next-envelope', pending: null };
            })
        };
    });

    it.each([
        ['demoted', { role: 'doctor' }],
        ['deactivated', { active: 0 }],
        ['id mismatch', { id: 99 }],
        ['username mismatch', { username: 'other-admin' }]
    ])('does not promote recovery for a %s stale session', (_label, change) => {
        persisted = { ...persisted, ...change };
        expect(() => acknowledgeRecoveryCodeForActiveAdmin(
            session, database, security, exactCode
        )).toThrow('Forbidden');
        expect(state).toEqual({ recovery: 'old-envelope', pending: exactCode });
        expect(security.acknowledgePendingRecoveryCode).not.toHaveBeenCalled();
    });

    it('promotes the pending recovery for a matching active administrator with the exact code', () => {
        acknowledgeRecoveryCodeForActiveAdmin(session, database, security, exactCode);
        expect(state).toEqual({ recovery: 'next-envelope', pending: null });
        expect(security.acknowledgePendingRecoveryCode).toHaveBeenCalledWith(exactCode);
    });
});

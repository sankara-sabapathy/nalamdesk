import { describe, expect, it, vi } from 'vitest';
import { buildAuthenticatedLoginResult } from './AuthResult';

const user = (role: string) => ({ id: 1, username: role, role, name: role, sessionId: 'private-session-id' });

describe('buildAuthenticatedLoginResult', () => {
    it('discloses a pending recovery code only to an authenticated admin', () => {
        const recovery = { getPendingRecoveryCode: vi.fn(() => 'NEW-RECOVERY-CODE') };
        expect(buildAuthenticatedLoginResult(user('admin'), recovery)).toMatchObject({
            success: true,
            pendingRecoveryCode: 'NEW-RECOVERY-CODE'
        });
        expect(recovery.getPendingRecoveryCode).toHaveBeenCalledOnce();
    });

    it.each(['doctor', 'nurse', 'receptionist'])('never reads or returns pending recovery for %s', role => {
        const recovery = { getPendingRecoveryCode: vi.fn(() => 'NEW-RECOVERY-CODE') };
        const result = buildAuthenticatedLoginResult(user(role), recovery) as any;
        expect(result.pendingRecoveryCode).toBeUndefined();
        expect(recovery.getPendingRecoveryCode).not.toHaveBeenCalled();
    });

    it('allowlists IPC user fields and excludes session or credential internals', () => {
        const result = buildAuthenticatedLoginResult({
            ...user('admin'),
            password: '$argon2id$hash'
        } as any, { getPendingRecoveryCode: () => null }) as any;
        expect(result.user.password).toBeUndefined();
        expect(result.user.sessionId).toBeUndefined();
    });
});

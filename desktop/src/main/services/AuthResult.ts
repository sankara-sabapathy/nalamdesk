import type { UserSession } from './SessionService';

export interface PendingRecoveryReader { getPendingRecoveryCode(): string | null }

/** Builds the only user object allowed across the authentication IPC boundary. */
export function buildAuthenticatedLoginResult(user: UserSession, recovery: PendingRecoveryReader) {
    const publicUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        ...(user.specialty ? { specialty: user.specialty } : {}),
        ...(user.license_number ? { license_number: user.license_number } : {}),
        ...(user.password_reset_required !== undefined
            ? { password_reset_required: user.password_reset_required }
            : {})
    };
    return {
        success: true as const,
        user: publicUser,
        ...(user.role === 'admin'
            ? { pendingRecoveryCode: recovery.getPendingRecoveryCode() || undefined }
            : {})
    };
}

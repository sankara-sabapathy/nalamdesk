import type { UserSession } from './SessionService';
import type { DatabaseService } from './DatabaseService';
import type { SecurityService } from './SecurityService';
import { isPersistedActiveAdminSession } from './AdminCredentialVerifier';

/** Commit a pending recovery rotation only for an administrator still active in the database. */
export function acknowledgeRecoveryCodeForActiveAdmin(
    sessionUser: UserSession | null,
    databaseService: DatabaseService,
    securityService: SecurityService,
    recoveryCode: string
): void {
    if (!isPersistedActiveAdminSession(sessionUser, databaseService)) throw new Error('Forbidden');
    securityService.acknowledgePendingRecoveryCode(recoveryCode);
}

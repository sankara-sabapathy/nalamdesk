import * as argon2 from 'argon2';
import type { UserSession } from './SessionService';
import type { DatabaseService } from './DatabaseService';

function getPersistedActiveAdmin(sessionUser: UserSession | null, databaseService: DatabaseService): any | null {
    if (!sessionUser) return null;
    const persisted = databaseService.getUserByUsername(sessionUser.username);
    if (!persisted || persisted.id !== sessionUser.id || persisted.username !== sessionUser.username ||
        persisted.active !== 1 || persisted.role !== 'admin') {
        return null;
    }
    return persisted;
}

/** Reject stale privileged sessions after role, activation, or identity changes. */
export function isPersistedActiveAdminSession(
    sessionUser: UserSession | null,
    databaseService: DatabaseService
): boolean {
    return getPersistedActiveAdmin(sessionUser, databaseService) !== null;
}

/** Re-authorize sensitive vault metadata changes against current DB state. */
export async function verifyPersistedActiveAdmin(
    sessionUser: UserSession | null,
    databaseService: DatabaseService,
    password: string
): Promise<boolean> {
    if (!sessionUser || typeof password !== 'string' || password.length === 0) return false;
    const persisted = getPersistedActiveAdmin(sessionUser, databaseService);
    if (!persisted || typeof persisted.password !== 'string') {
        return false;
    }
    try {
        return await argon2.verify(persisted.password, password);
    } catch {
        return false;
    }
}

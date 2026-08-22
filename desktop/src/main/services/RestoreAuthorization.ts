import * as argon2 from 'argon2';

export interface ExistingRestoreAuthorizationInput {
    hasDatabase: boolean;
    hasConfig: boolean;
    databaseOpen: boolean;
    sessionUser: { id?: number; username?: string; role?: string } | null;
    persistedAdmin: { id: number; username: string; role: string; active: number; password: string } | null;
    currentAdminPassword?: string;
}

/** Clean targets need only bundle recovery. Replacing a live pair additionally
 * requires a freshly verified active persisted admin, never a cached role. */
export async function requireExistingRestoreAuthorization(
    input: ExistingRestoreAuthorizationInput,
    verify: (hash: string, password: string) => Promise<boolean> = argon2.verify
): Promise<void> {
    if (!input.hasDatabase && !input.hasConfig) return;
    if (!input.hasDatabase || !input.hasConfig) throw new Error('LIVE_VAULT_INCOMPLETE');
    if (!input.databaseOpen) throw new Error('LIVE_VAULT_RECOVERY_REQUIRED');
    const session = input.sessionUser;
    const admin = input.persistedAdmin;
    if (!session || session.role !== 'admin' || session.username !== 'admin' || !admin ||
        admin.active !== 1 || admin.role !== 'admin' || admin.username !== 'admin' || session.id !== admin.id) {
        throw new Error('RESTORE_ADMIN_AUTHORIZATION_REQUIRED');
    }
    if (!input.currentAdminPassword || !await verify(admin.password, input.currentAdminPassword)) {
        throw new Error('INVALID_ADMIN_CREDENTIAL');
    }
}

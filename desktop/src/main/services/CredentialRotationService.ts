import * as argon2 from 'argon2';

export type CredentialRotationStep = 'after-hash' | 'after-prepare' | 'after-apply' | 'after-complete';

export interface CredentialRotationHooks {
    onStep?: (step: CredentialRotationStep) => void;
}

interface RotationJournal {
    username: string;
    previous_hash: string;
    replacement_hash: string;
    previous_reset_required: number;
    phase: 'prepared' | 'applied';
}

const MIN_PASSWORD_LENGTH = 6;

/**
 * Changes login credentials inside the encrypted database. Login credentials
 * intentionally never participate in the device or recovery envelope paths.
 * The journal contains Argon2 hashes only and rolls an interrupted apply back
 * to the previously accepted credential on the next unlock.
 */
export class CredentialRotationService {
    private db: any;

    constructor(private readonly hooks: CredentialRotationHooks = {}) { }

    setDb(db: any): void {
        this.db = db;
    }

    async changeOwnPassword(
        actorId: number,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        const actor = this.getActiveUser(actorId);
        await this.rotate(actor, currentPassword, newPassword, false, actorId);
    }

    async resetUserPassword(
        adminId: number,
        currentAdminPassword: string,
        targetUserId: number,
        temporaryPassword: string
    ): Promise<void> {
        const admin = this.getActiveUser(adminId);
        if (admin.role !== 'admin') throw new Error('FORBIDDEN');
        if (admin.id === targetUserId) throw new Error('USE_SELF_PASSWORD_CHANGE');
        if (!await argon2.verify(admin.password, currentAdminPassword)) {
            throw new Error('INVALID_CREDENTIALS');
        }
        const target = this.getActiveUser(targetUserId);
        await this.rotate(target, undefined, temporaryPassword, true, adminId, {
            id: admin.id,
            password: admin.password
        });
    }

    /** Restore the old login hash after any interrupted pre-completion phase. */
    reconcileInterruptedRotation(): void {
        this.assertReady();
        const journal = this.db.prepare(`
            SELECT username, previous_hash, replacement_hash, previous_reset_required, phase
            FROM credential_rotation_journal WHERE id = 1
        `).get() as RotationJournal | undefined;
        if (!journal) return;

        this.db.transaction(() => {
            const user = this.db.prepare('SELECT password FROM users WHERE username = ?').get(journal.username);
            if (!user) throw new Error('CREDENTIAL_JOURNAL_USER_MISSING');
            if (journal.phase === 'applied') {
                if (user.password === journal.replacement_hash) {
                    this.db.prepare(`
                        UPDATE users SET password = ?, password_reset_required = ? WHERE username = ?
                    `).run(journal.previous_hash, journal.previous_reset_required, journal.username);
                } else if (user.password !== journal.previous_hash) {
                    throw new Error('CREDENTIAL_JOURNAL_STATE_MISMATCH');
                }
            } else if (journal.phase !== 'prepared') {
                throw new Error('CREDENTIAL_JOURNAL_CORRUPT');
            }
            this.db.prepare('DELETE FROM credential_rotation_journal WHERE id = 1').run();
        })();
    }

    private async rotate(
        target: any,
        currentPassword: string | undefined,
        newPassword: string,
        forceReset: boolean,
        actingUserId: number,
        expectedAuthorizer?: { id: number; password: string }
    ): Promise<void> {
        this.assertPassword(newPassword);
        this.reconcileInterruptedRotation();
        if (currentPassword !== undefined && !await argon2.verify(target.password, currentPassword)) {
            throw new Error('INVALID_CREDENTIALS');
        }
        if (await argon2.verify(target.password, newPassword)) {
            throw new Error('PASSWORD_UNCHANGED');
        }

        const replacementHash = await argon2.hash(newPassword);
        this.step('after-hash');
        if (expectedAuthorizer) {
            const currentAuthorizer = this.db.prepare('SELECT password, role, active FROM users WHERE id = ?')
                .get(expectedAuthorizer.id);
            if (!currentAuthorizer
                || currentAuthorizer.password !== expectedAuthorizer.password
                || currentAuthorizer.role !== 'admin'
                || currentAuthorizer.active !== 1) {
                throw new Error('CREDENTIAL_CHANGED_CONCURRENTLY');
            }
        }
        this.db.prepare(`
            INSERT INTO credential_rotation_journal(
                id, username, previous_hash, replacement_hash, previous_reset_required, phase, started_at
            ) VALUES (1, ?, ?, ?, ?, 'prepared', CURRENT_TIMESTAMP)
        `).run(target.username, target.password, replacementHash, target.password_reset_required ?? 0);
        this.step('after-prepare');

        this.db.transaction(() => {
            const result = this.db.prepare(`
                UPDATE users SET password = ?, password_reset_required = ?
                WHERE id = ? AND password = ?
            `).run(replacementHash, forceReset ? 1 : 0, target.id, target.password);
            if (result.changes !== 1) throw new Error('CREDENTIAL_CHANGED_CONCURRENTLY');
            this.db.prepare(`
                UPDATE credential_rotation_journal SET phase = 'applied' WHERE id = 1
            `).run();
        })();
        this.step('after-apply');

        try {
            this.db.transaction(() => {
                this.db.prepare('DELETE FROM credential_rotation_journal WHERE id = 1').run();
                this.db.prepare(`
                    INSERT INTO audit_logs(action, table_name, record_id, user_id, details)
                    VALUES (?, 'users', ?, ?, ?)
                `).run(
                    forceReset ? 'USER_PASSWORD_RESET' : 'LOGIN_PASSWORD_CHANGE',
                    target.id,
                    actingUserId,
                    forceReset ? `Reset login password for ${target.username}` : `Changed login password for ${target.username}`
                );
            })();
        } catch (error) {
            // A normal completion error is recoverable without waiting for a
            // restart. A true process interruption is reconciled on unlock.
            this.reconcileInterruptedRotation();
            throw error;
        }
        this.step('after-complete');
    }

    private getActiveUser(id: number): any {
        this.assertReady();
        const user = this.db.prepare(`
            SELECT id, username, password, role, active, password_reset_required FROM users WHERE id = ?
        `).get(id);
        if (!user || user.active !== 1) throw new Error('ACCESS_DENIED');
        return user;
    }

    private assertPassword(password: string): void {
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            throw new Error('PASSWORD_TOO_SHORT');
        }
    }

    private assertReady(): void {
        if (!this.db) throw new Error('VAULT_LOCKED');
    }

    private step(step: CredentialRotationStep): void {
        this.hooks.onStep?.(step);
    }
}

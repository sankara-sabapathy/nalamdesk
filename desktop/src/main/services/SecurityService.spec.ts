import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DeviceKeyStore } from './DeviceKeyStore';
import { SecurityService } from './SecurityService';

vi.mock('argon2', () => ({
    argon2id: 2,
    hash: vi.fn(async (secret: string, options: { salt: Buffer }) =>
        crypto.createHash('sha256').update(options.salt).update(secret).digest())
}));

interface DbState { vault?: { vault_id: string; key_version: number } }
const databases = new Map<string, DbState>();
let rejectOpen = false;
let failInsert = false;

vi.mock('better-sqlite3-multiple-ciphers', () => ({
    default: class MockDatabase {
        private state: DbState;
        constructor(private file: string) {
            this.state = databases.get(file) || {};
            databases.set(file, this.state);
        }
        pragma(statement: string) {
            if (rejectOpen && statement.startsWith('key =')) throw new Error('file is not a database');
        }
        exec() { }
        prepare(sql: string) {
            if (sql.includes('count(*)')) return { get: () => ({ count: 1 }) };
            if (sql.startsWith('SELECT vault_id')) return { get: () => this.state.vault };
            if (sql.startsWith('INSERT INTO')) return {
                run: (vaultId: string, keyVersion: number) => {
                    if (failInsert) throw new Error('forced binding failure');
                    this.state.vault = { vault_id: vaultId, key_version: keyVersion };
                }
            };
            throw new Error(`Unexpected SQL: ${sql}`);
        }
        close() { }
    }
}));

class MemoryDeviceKeyStore implements DeviceKeyStore {
    available = true;
    private maskByte = 0x5a;
    status() {
        return this.available
            ? { available: true, provider: 'test-device-store' }
            : { available: false, provider: 'test-device-store', reason: 'ENCRYPTION_UNAVAILABLE' as const };
    }
    protect(value: Buffer): Buffer { return Buffer.from(value.map(byte => byte ^ this.maskByte)); }
    unprotect(value: Buffer): Buffer { return this.protect(value); }
}

describe('SecurityService v3', () => {
    let directory: string;
    let dbPath: string;
    let store: MemoryDeviceKeyStore;

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-security-'));
        dbPath = path.join(directory, 'nalamdesk.db');
        fs.writeFileSync(dbPath, '');
        databases.clear();
        rejectOpen = false;
        failInsert = false;
        store = new MemoryDeviceKeyStore();
    });

    afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

    it('creates a v3 config without the admin password or plaintext DEK', async () => {
        const service = new SecurityService(store);
        const code = await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        const text = fs.readFileSync(path.join(directory, 'security.json'), 'utf8');
        const config = JSON.parse(text);

        expect(config.version).toBe(3);
        expect(config.vaultId).toMatch(/^[0-9a-f-]{36}$/);
        expect(config.keyVersion).toBe(1);
        expect(config.device.provider).toBe('test-device-store');
        expect(config.recovery.kdf).toBe('argon2id');
        expect(text).not.toContain('admin-secret');
        expect(code).toMatch(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
    });

    it('unlocks after a cold start without receiving any user password', async () => {
        const first = new SecurityService(store);
        await first.setup('admin-secret', dbPath, directory);
        first.completeProvisioning();
        first.closeDb();

        const coldStart = new SecurityService(store);
        await expect(coldStart.initializeDevice(dbPath, directory)).resolves.toEqual({ migrated: false });
        expect(coldStart.getDb()).toBeTruthy();
    });

    it('fails closed when device encryption is unavailable', async () => {
        store.available = false;
        const service = new SecurityService(store);
        await expect(service.setup('irrelevant', dbPath, directory)).rejects.toThrow('ENCRYPTION_UNAVAILABLE');
    });

    it('rolls back a newly-created database when setup fails after binding and permits retry', async () => {
        const failing = new SecurityService(store);
        vi.spyOn(failing as any, 'saveConfigAtomic').mockImplementation(() => { throw new Error('forced config failure'); });
        await expect(failing.setup('admin-secret', dbPath, directory)).rejects.toThrow('forced config failure');
        expect(fs.existsSync(dbPath)).toBe(false);
        expect(fs.existsSync(path.join(directory, 'security.json'))).toBe(false);
        expect(fs.existsSync(path.join(directory, 'security-setup.json'))).toBe(false);

        databases.delete(dbPath);
        const retry = new SecurityService(store);
        await expect(retry.setup('admin-secret', dbPath, directory)).resolves.toBeTruthy();
        retry.completeProvisioning();
    });

    it('rolls back an interrupted full provisioning on restart and permits retry', async () => {
        const interrupted = new SecurityService(store);
        await interrupted.setup('admin-secret', dbPath, directory);
        expect(fs.existsSync(path.join(directory, 'security-setup.json'))).toBe(true);
        interrupted.closeDb();

        const restarted = new SecurityService(store);
        restarted.reconcileProvisioning(dbPath, directory);
        expect(fs.existsSync(dbPath)).toBe(false);
        expect(fs.existsSync(path.join(directory, 'security.json'))).toBe(false);
        expect(fs.existsSync(path.join(directory, 'security-setup.json'))).toBe(false);

        databases.delete(dbPath);
        const code = await restarted.setup('admin-secret', dbPath, directory);
        restarted.completeProvisioning();
        expect(code).toBe(restarted.getPendingRecoveryCode());
    });

    it('keeps a fresh recovery code device-encrypted until exact acknowledgement', async () => {
        const service = new SecurityService(store);
        const code = await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        const configText = fs.readFileSync(path.join(directory, 'security.json'), 'utf8');
        expect(configText).not.toContain(code);
        service.closeDb();

        const restarted = new SecurityService(store);
        await restarted.initializeDevice(dbPath, directory);
        expect(restarted.getPendingRecoveryCode()).toBe(code);
        expect(() => restarted.acknowledgePendingRecoveryCode(`${code}X`)).toThrow('INVALID_RECOVERY_ACK');
        restarted.acknowledgePendingRecoveryCode(code);
        expect(restarted.getPendingRecoveryCode()).toBeNull();
    });

    it('reconciles an already-complete provisioning journal after cleanup interruption', async () => {
        let failed = false;
        const service = new SecurityService(store, {
            onStep: step => {
                if (step === 'cleanup-setup-journal' && !failed) {
                    failed = true;
                    throw new Error('cleanup interrupted');
                }
            }
        });
        await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        expect(fs.existsSync(path.join(directory, 'security-setup.json'))).toBe(true);
        service.closeDb();

        const restarted = new SecurityService(store);
        restarted.reconcileProvisioning(dbPath, directory);
        expect(fs.existsSync(path.join(directory, 'security-setup.json'))).toBe(false);
        await expect(restarted.initializeDevice(dbPath, directory)).resolves.toEqual({ migrated: false });
    });

    it('refuses and preserves an existing unclaimed database during fresh setup', async () => {
        fs.writeFileSync(dbPath, 'existing clinic data');
        await expect(new SecurityService(store).setup('admin-secret', dbPath, directory))
            .rejects.toThrow('UNCLAIMED_DATABASE_PRESENT');
        expect(fs.readFileSync(dbPath, 'utf8')).toBe('existing clinic data');
    });

    it('requires recovery when the device envelope cannot be decrypted', async () => {
        const service = new SecurityService(store);
        await service.setup('irrelevant', dbPath, directory);
        service.completeProvisioning();
        service.closeDb();
        vi.spyOn(store, 'unprotect').mockImplementation(() => { throw new Error('keychain denied'); });

        await expect(new SecurityService(store).initializeDevice(dbPath, directory)).rejects.toThrow('DEVICE_UNLOCK_FAILED');
    });

    it('re-enrols a replacement device with the recovery code', async () => {
        const originalStore = new MemoryDeviceKeyStore();
        const original = new SecurityService(originalStore);
        const recoveryCode = await original.setup('admin-secret', dbPath, directory);
        original.completeProvisioning();
        original.closeDb();

        const replacementStore = new MemoryDeviceKeyStore();
        (replacementStore as any).maskByte = 0x33;
        const replacement = new SecurityService(replacementStore);
        await expect(replacement.recoverDevice(recoveryCode, directory, dbPath)).resolves.toEqual({ migrated: false });
        replacement.closeDb();
        await expect(new SecurityService(replacementStore).initializeDevice(dbPath, directory)).resolves.toEqual({ migrated: false });
    });

    it('rejects an incorrect recovery code without rewriting config', async () => {
        const service = new SecurityService(store);
        await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        service.closeDb();
        const before = fs.readFileSync(path.join(directory, 'security.json'));

        await expect(service.recoverDevice('WRONG-CODE', directory, dbPath)).rejects.toThrow('INVALID_RECOVERY_CODE');
        expect(fs.readFileSync(path.join(directory, 'security.json'))).toEqual(before);
    });

    it('detects a swapped security config using the database vault binding', async () => {
        const service = new SecurityService(store);
        await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        service.closeDb();
        const configPath = path.join(directory, 'security.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.vaultId = crypto.randomUUID();
        fs.writeFileSync(configPath, JSON.stringify(config));

        await expect(new SecurityService(store).initializeDevice(dbPath, directory)).rejects.toThrow('VAULT_BINDING_MISMATCH');
    });

    it('migrates v2 to v3 and durably protects the pending recovery acknowledgement', async () => {
        const legacyBuilder = new SecurityService(store) as any;
        const salt = crypto.randomBytes(16);
        const legacyKey = crypto.randomBytes(32);
        const kek = await legacyBuilder.deriveKey('legacy-master', salt);
        const wrapped = legacyBuilder.aesEncrypt(legacyKey, kek);
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2,
            salt: salt.toString('hex'),
            wrappedKey: wrapped.wrappedKey,
            iv: wrapped.iv
        }));

        const service = new SecurityService(store);
        const result = await service.migrateLegacy('legacy-master', dbPath, directory);
        const migratedText = fs.readFileSync(path.join(directory, 'security.json'), 'utf8');
        const migrated = JSON.parse(migratedText);
        expect(result.migrated).toBe(true);
        const pendingCode = service.getPendingRecoveryCode();
        expect(pendingCode).toMatch(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
        expect(migrated.version).toBe(3);
        expect(migrated.migratedFrom).toBe(2);
        expect(migratedText).not.toContain('legacy-master');
        expect(migratedText).not.toContain(pendingCode!);
        expect(fs.existsSync(`${dbPath}.pre-v3-migration`)).toBe(false);
        expect(fs.existsSync(path.join(directory, 'security-migration.json'))).toBe(false);
    });

    it('can migrate v2 through its legacy recovery wrapper when the master password is unavailable', async () => {
        const legacyBuilder = new SecurityService(store) as any;
        const legacyKey = crypto.randomBytes(32);
        const passwordSalt = crypto.randomBytes(16);
        const recoverySalt = crypto.randomBytes(16);
        const passwordWrapped = legacyBuilder.aesEncrypt(legacyKey, await legacyBuilder.deriveLegacyKey('old-master', passwordSalt));
        const recoveryWrapped = legacyBuilder.aesEncrypt(legacyKey, await legacyBuilder.deriveLegacyKey('old-recovery', recoverySalt));
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2,
            salt: passwordSalt.toString('hex'),
            wrappedKey: passwordWrapped.wrappedKey,
            iv: passwordWrapped.iv,
            recovery: {
                salt: recoverySalt.toString('hex'),
                wrappedKey: recoveryWrapped.wrappedKey,
                iv: recoveryWrapped.iv
            }
        }));

        const service = new SecurityService(store);
        const result = await service.recoverDevice('old-recovery', directory, dbPath);
        expect(result.migrated).toBe(true);
        expect(service.getPendingRecoveryCode()).toBeTruthy();
        expect(JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8')).version).toBe(3);
    });

    it('keeps migration recovery acknowledgement across restart until explicitly cleared', async () => {
        const legacyBuilder = new SecurityService(store) as any;
        const salt = crypto.randomBytes(16);
        const key = crypto.randomBytes(32);
        const wrapped = legacyBuilder.aesEncrypt(key, await legacyBuilder.deriveLegacyKey('legacy', salt));
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
        }));
        await new SecurityService(store).migrateLegacy('legacy', dbPath, directory);

        const restarted = new SecurityService(store);
        await restarted.initializeDevice(dbPath, directory);
        const pending = restarted.getPendingRecoveryCode();
        expect(pending).toBeTruthy();
        expect(() => restarted.acknowledgePendingRecoveryCode('WRONG-CODE')).toThrow('INVALID_RECOVERY_ACK');
        restarted.acknowledgePendingRecoveryCode(pending!);
        expect(restarted.getPendingRecoveryCode()).toBeNull();
    });

    it.each([1, 2] as const)(
        'recovers a migrated v%s vault on a new device with the final pending code and retires transition recovery',
        async version => {
            const legacySecret = `legacy-v${version}`;
            if (version === 1) {
                fs.writeFileSync(path.join(directory, 'salt.bin'), crypto.randomBytes(16));
            } else {
                const builder = new SecurityService(store) as any;
                const salt = crypto.randomBytes(16);
                const key = crypto.randomBytes(32);
                const wrapped = builder.aesEncrypt(key, await builder.deriveLegacyKey(legacySecret, salt));
                fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
                    version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
                }));
            }
            const migrated = new SecurityService(store);
            await migrated.migrateLegacy(legacySecret, dbPath, directory);
            const finalCode = migrated.getPendingRecoveryCode()!;
            migrated.closeDb();

            const replacementStore = new MemoryDeviceKeyStore();
            (replacementStore as any).maskByte = 0x33;
            const replacement = new SecurityService(replacementStore);
            await replacement.recoverDevice(finalCode, directory, dbPath);
            expect(replacement.getPendingRecoveryCode()).toBeNull();
            expect(JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8')).transitionRecovery).toBeUndefined();
            replacement.closeDb();
            await expect(new SecurityService(replacementStore).initializeDevice(dbPath, directory))
                .resolves.toEqual({ migrated: false });
        }
    );

    it.each([1, 2] as const)(
        'recovers a migrated v%s vault on a new device with its transition secret and rotates recovery again',
        async version => {
            const legacySecret = `legacy-v${version}`;
            if (version === 1) {
                fs.writeFileSync(path.join(directory, 'salt.bin'), crypto.randomBytes(16));
            } else {
                const builder = new SecurityService(store) as any;
                const salt = crypto.randomBytes(16);
                const key = crypto.randomBytes(32);
                const wrapped = builder.aesEncrypt(key, await builder.deriveLegacyKey(legacySecret, salt));
                fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
                    version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
                }));
            }
            const migrated = new SecurityService(store);
            await migrated.migrateLegacy(legacySecret, dbPath, directory);
            migrated.closeDb();

            const replacementStore = new MemoryDeviceKeyStore();
            (replacementStore as any).maskByte = 0x33;
            const replacement = new SecurityService(replacementStore);
            await replacement.recoverDevice(legacySecret, directory, dbPath);
            const rotatedCode = replacement.getPendingRecoveryCode();
            expect(rotatedCode).toMatch(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
            const config = JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8'));
            expect(config.transitionRecovery?.purpose).toBe('legacy-transition');
            expect(() => replacement.acknowledgePendingRecoveryCode('WRONG')).toThrow('INVALID_RECOVERY_ACK');
            replacement.acknowledgePendingRecoveryCode(rotatedCode!);
            replacement.closeDb();
            await expect(new SecurityService(store).initializeDevice(dbPath, directory))
                .rejects.toThrow('DEVICE_UNLOCK_FAILED');
            await expect(new SecurityService(replacementStore).initializeDevice(dbPath, directory))
                .resolves.toEqual({ migrated: false });
        }
    );

    it('migrates a v1 direct-password database with a journaled rekey', async () => {
        fs.writeFileSync(path.join(directory, 'salt.bin'), crypto.randomBytes(16));
        const service = new SecurityService(store);
        const result = await service.migrateLegacy('legacy-master', dbPath, directory);
        const config = JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8'));

        expect(result).toMatchObject({ migrated: true });
        expect(config).toMatchObject({ version: 3, migratedFrom: 1 });
        expect(fs.existsSync(path.join(directory, 'salt.bin'))).toBe(false);
        expect(fs.existsSync(path.join(directory, 'salt.bin.migrated'))).toBe(true);
    });

    it('rolls the database back when migration fails after the snapshot', async () => {
        const legacyBuilder = new SecurityService(store) as any;
        const salt = crypto.randomBytes(16);
        const legacyKey = crypto.randomBytes(32);
        const wrapped = legacyBuilder.aesEncrypt(legacyKey, await legacyBuilder.deriveKey('legacy-master', salt));
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
        }));
        const original = fs.readFileSync(dbPath);
        const originalConfig = fs.readFileSync(path.join(directory, 'security.json'));
        failInsert = true;

        await expect(new SecurityService(store).migrateLegacy('legacy-master', dbPath, directory)).rejects.toThrow('forced binding failure');
        expect(fs.readFileSync(dbPath)).toEqual(original);
        expect(fs.readFileSync(path.join(directory, 'security.json'))).toEqual(originalConfig);
    });

    it.each(['cleanup-database-backup', 'cleanup-config-backup', 'cleanup-journal'] as const)(
        'keeps committed migration authoritative when %s fails and reconciles on restart',
        async cleanupStep => {
            const legacyBuilder = new SecurityService(store) as any;
            const salt = crypto.randomBytes(16);
            const key = crypto.randomBytes(32);
            const wrapped = legacyBuilder.aesEncrypt(key, await legacyBuilder.deriveLegacyKey('legacy', salt));
            fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
                version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
            }));
            let failed = false;
            const service = new SecurityService(store, {
                onStep: step => {
                    if (step === cleanupStep && !failed) { failed = true; throw new Error('cleanup failure'); }
                }
            });
            await expect(service.migrateLegacy('legacy', dbPath, directory)).resolves.toEqual({ migrated: true });
            expect(JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8')).version).toBe(3);
            service.closeDb();
            await expect(new SecurityService(store).initializeDevice(dbPath, directory)).resolves.toEqual({ migrated: false });
            expect(fs.existsSync(path.join(directory, 'security-migration.json'))).toBe(false);
        }
    );

    it('never rolls back after the atomic v3 config commit point', async () => {
        const legacyBuilder = new SecurityService(store) as any;
        const salt = crypto.randomBytes(16);
        const key = crypto.randomBytes(32);
        const wrapped = legacyBuilder.aesEncrypt(key, await legacyBuilder.deriveLegacyKey('legacy', salt));
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
        }));
        const service = new SecurityService(store, {
            onStep: step => { if (step === 'migration-after-config-commit') throw new Error('post-commit failure'); }
        });
        await expect(service.migrateLegacy('legacy', dbPath, directory)).resolves.toEqual({ migrated: true });
        expect(JSON.parse(fs.readFileSync(path.join(directory, 'security.json'), 'utf8')).version).toBe(3);
    });

    it('reconciles a failed legacy-salt cleanup without rolling back committed v1 migration', async () => {
        fs.writeFileSync(path.join(directory, 'salt.bin'), crypto.randomBytes(16));
        let failed = false;
        const service = new SecurityService(store, {
            onStep: step => {
                if (step === 'cleanup-legacy-salt' && !failed) { failed = true; throw new Error('cleanup failure'); }
            }
        });
        await service.migrateLegacy('legacy-master', dbPath, directory);
        service.closeDb();
        await expect(new SecurityService(store).initializeDevice(dbPath, directory)).resolves.toEqual({ migrated: false });
        expect(fs.existsSync(path.join(directory, 'salt.bin.migrated'))).toBe(true);
    });

    it('reconciles an interrupted pre-commit migration by restoring its snapshots', async () => {
        const configPath = path.join(directory, 'security.json');
        const backupPath = `${dbPath}.pre-v3-migration`;
        const configBackup = `${configPath}.pre-v3-migration`;
        fs.writeFileSync(dbPath, 'partially migrated');
        fs.writeFileSync(backupPath, 'original database');
        fs.writeFileSync(configPath, JSON.stringify({ version: 3, incomplete: true }));
        fs.writeFileSync(configBackup, JSON.stringify({ version: 2, salt: '00', wrappedKey: '00', iv: '00' }));
        fs.writeFileSync(path.join(directory, 'security-migration.json'), JSON.stringify({
            version: 1,
            sourceVersion: 2,
            phase: 'snapshot-created',
            databaseBackup: backupPath,
            configBackup,
            startedAt: new Date().toISOString()
        }));

        await expect(new SecurityService(store).initializeDevice(dbPath, directory)).rejects.toThrow('LEGACY_MIGRATION_REQUIRED');
        expect(fs.readFileSync(dbPath, 'utf8')).toBe('original database');
        expect(JSON.parse(fs.readFileSync(configPath, 'utf8')).version).toBe(2);
        expect(fs.existsSync(path.join(directory, 'security-migration.json'))).toBe(false);
    });

    it('records rollback restoration before best-effort cleanup and never needs an already deleted snapshot', async () => {
        const configPath = path.join(directory, 'security.json');
        const backupPath = `${dbPath}.pre-v3-migration`;
        const configBackup = `${configPath}.pre-v3-migration`;
        fs.writeFileSync(dbPath, 'partially migrated');
        fs.writeFileSync(backupPath, 'original database');
        fs.writeFileSync(configPath, JSON.stringify({ version: 3, incomplete: true }));
        fs.writeFileSync(configBackup, JSON.stringify({ version: 2, salt: '00', wrappedKey: '00', iv: '00' }));
        fs.writeFileSync(path.join(directory, 'security-migration.json'), JSON.stringify({
            version: 1,
            sourceVersion: 2,
            phase: 'snapshot-created',
            databaseBackup: backupPath,
            configBackup,
            startedAt: new Date().toISOString()
        }));
        let failed = false;
        const firstRestart = new SecurityService(store, {
            onStep: step => {
                if (step === 'cleanup-rollback-database-backup' && !failed) {
                    failed = true;
                    throw new Error('cleanup interrupted');
                }
            }
        });
        await expect(firstRestart.initializeDevice(dbPath, directory)).rejects.toThrow('LEGACY_MIGRATION_REQUIRED');
        const journal = JSON.parse(fs.readFileSync(path.join(directory, 'security-migration.json'), 'utf8'));
        expect(journal.phase).toBe('rollback-restored');
        // Simulate another cleanup artifact already having disappeared.
        if (fs.existsSync(configBackup)) fs.unlinkSync(configBackup);

        await expect(new SecurityService(store).initializeDevice(dbPath, directory))
            .rejects.toThrow('LEGACY_MIGRATION_REQUIRED');
        expect(fs.readFileSync(dbPath, 'utf8')).toBe('original database');
        expect(fs.existsSync(path.join(directory, 'security-migration.json'))).toBe(false);
    });

    it('exposes only portable recovery metadata for backup consumers', async () => {
        const service = new SecurityService(store);
        await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        const metadata = service.getPortableVaultMetadata() as any;
        expect(metadata.device).toBeUndefined();
        expect(Object.keys(metadata).sort()).toEqual(['keyVersion', 'recovery', 'vaultId', 'version']);
    });

    it('installs portable metadata only after recovery and vault-binding validation', async () => {
        const source = new SecurityService(store);
        const recoveryCode = await source.setup('admin-secret', dbPath, directory);
        source.completeProvisioning();
        const metadata = source.getPortableVaultMetadata();
        source.closeDb();

        const restoreDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-security-restore-'));
        const restoreDbPath = path.join(restoreDirectory, 'nalamdesk.db');
        fs.copyFileSync(dbPath, restoreDbPath);
        databases.set(restoreDbPath, { vault: { ...databases.get(dbPath)!.vault! } });
        try {
            const restored = new SecurityService(store);
            await restored.installPortableVaultMetadata(metadata, recoveryCode, restoreDbPath, restoreDirectory);
            expect(JSON.parse(fs.readFileSync(path.join(restoreDirectory, 'security.json'), 'utf8'))).toMatchObject({
                version: 3,
                vaultId: metadata.vaultId
            });
        } finally {
            fs.rmSync(restoreDirectory, { recursive: true, force: true });
        }
    });

    it('retires transition recovery when portable metadata is installed with the primary code', async () => {
        const legacySecret = 'legacy-portable-secret';
        const builder = new SecurityService(store) as any;
        const salt = crypto.randomBytes(16);
        const key = crypto.randomBytes(32);
        const wrapped = builder.aesEncrypt(key, await builder.deriveLegacyKey(legacySecret, salt));
        fs.writeFileSync(path.join(directory, 'security.json'), JSON.stringify({
            version: 2, salt: salt.toString('hex'), wrappedKey: wrapped.wrappedKey, iv: wrapped.iv
        }));
        const migrated = new SecurityService(store);
        await migrated.migrateLegacy(legacySecret, dbPath, directory);
        const finalCode = migrated.getPendingRecoveryCode()!;
        const metadata = migrated.getPortableVaultMetadata();
        expect(metadata.transitionRecovery).toBeTruthy();
        migrated.closeDb();

        const restoreDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-security-transition-'));
        const restoreDbPath = path.join(restoreDirectory, 'nalamdesk.db');
        fs.copyFileSync(dbPath, restoreDbPath);
        databases.set(restoreDbPath, { vault: { ...databases.get(dbPath)!.vault! } });
        try {
            const restored = new SecurityService(store);
            await restored.installPortableVaultMetadata(metadata, finalCode, restoreDbPath, restoreDirectory);
            const installed = JSON.parse(fs.readFileSync(path.join(restoreDirectory, 'security.json'), 'utf8'));
            expect(installed.transitionRecovery).toBeUndefined();
            expect(installed.pendingRecoveryAck).toBeUndefined();
            restored.closeDb();
            await expect(new SecurityService(store).recoverDevice(
                legacySecret, restoreDirectory, restoreDbPath
            )).rejects.toThrow('INVALID_RECOVERY_CODE');
        } finally {
            fs.rmSync(restoreDirectory, { recursive: true, force: true });
        }
    });

    it('closes the database and restores the prior config when device recovery commit fails', async () => {
        const source = new SecurityService(store);
        const recoveryCode = await source.setup('admin-secret', dbPath, directory);
        source.completeProvisioning();
        source.closeDb();
        const configPath = path.join(directory, 'security.json');
        const before = fs.readFileSync(configPath, 'utf8');

        const replacement = new SecurityService(store);
        const save = (replacement as any).saveConfigAtomic.bind(replacement);
        vi.spyOn(replacement as any, 'saveConfigAtomic').mockImplementation((config: any) => {
            save(config);
            throw new Error('forced post-commit failure');
        });
        await expect(replacement.recoverDevice(recoveryCode, directory, dbPath))
            .rejects.toThrow('forced post-commit failure');
        expect(replacement.getDb()).toBeFalsy();
        expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
    });

    it('closes the database and restores an existing config when portable install commit fails', async () => {
        const source = new SecurityService(store);
        const recoveryCode = await source.setup('admin-secret', dbPath, directory);
        source.completeProvisioning();
        const metadata = source.getPortableVaultMetadata();
        source.closeDb();

        const restoreDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-security-install-failure-'));
        const restoreDbPath = path.join(restoreDirectory, 'nalamdesk.db');
        const restoreConfigPath = path.join(restoreDirectory, 'security.json');
        const previous = '{"sentinel":true}';
        fs.copyFileSync(dbPath, restoreDbPath);
        fs.writeFileSync(restoreConfigPath, previous);
        databases.set(restoreDbPath, { vault: { ...databases.get(dbPath)!.vault! } });
        try {
            const restored = new SecurityService(store);
            const save = (restored as any).saveConfigAtomic.bind(restored);
            vi.spyOn(restored as any, 'saveConfigAtomic').mockImplementation((config: any) => {
                save(config);
                throw new Error('forced portable commit failure');
            });
            await expect(restored.installPortableVaultMetadata(
                metadata, recoveryCode, restoreDbPath, restoreDirectory
            )).rejects.toThrow('forced portable commit failure');
            expect(restored.getDb()).toBeFalsy();
            expect(fs.readFileSync(restoreConfigPath, 'utf8')).toBe(previous);
        } finally {
            fs.rmSync(restoreDirectory, { recursive: true, force: true });
        }
    });

    it('rejects hostile portable KDF parameters before deriving a key', async () => {
        const source = new SecurityService(store);
        const recoveryCode = await source.setup('admin-secret', dbPath, directory);
        source.completeProvisioning();
        const metadata = source.getPortableVaultMetadata();
        source.closeDb();
        metadata.recovery.kdfParams.memoryCost = Number.MAX_SAFE_INTEGER;

        await expect(new SecurityService(store).installPortableVaultMetadata(
            metadata,
            recoveryCode,
            dbPath,
            directory
        )).rejects.toThrow('INVALID_RECOVERY_ENVELOPE');
    });

    it('authenticates the recovery envelope against vault context using AAD', async () => {
        const service = new SecurityService(store);
        const code = await service.setup('admin-secret', dbPath, directory);
        service.completeProvisioning();
        const metadata = service.getPortableVaultMetadata();
        service.closeDb();
        metadata.vaultId = crypto.randomUUID();
        await expect(new SecurityService(store).installPortableVaultMetadata(
            metadata, code, dbPath, directory
        )).rejects.toThrow();
    });

    it.each(['EPERM', 'EINVAL'])(
        'propagates Windows regular-file fsync %s failures',
        code => {
            const failure = Object.assign(new Error(`regular file ${code}`), { code });
            const service = new SecurityService(store, {
                platform: 'win32',
                fsync: () => { throw failure; }
            });
            expect(() => (service as any).fsyncFile(dbPath)).toThrow(`regular file ${code}`);
        }
    );

    it.each(['EPERM', 'EINVAL', 'ENOSYS', 'ENOTSUP'])(
        'tolerates Windows directory fsync incompatibility %s',
        code => {
            const unsupported = Object.assign(new Error(`directory ${code}`), { code });
            const service = new SecurityService(store, {
                platform: 'win32',
                fsync: () => { throw unsupported; }
            });
            (service as any).configurePaths(dbPath, directory);
            expect(() => (service as any).fsyncDirectory()).not.toThrow();
        }
    );

    it('propagates genuine Windows directory fsync I/O failures', () => {
        const failure = Object.assign(new Error('directory device I/O failure'), { code: 'EIO' });
        const service = new SecurityService(store, {
            platform: 'win32',
            fsync: () => { throw failure; }
        });
        (service as any).configurePaths(dbPath, directory);
        expect(() => (service as any).fsyncDirectory()).toThrow('directory device I/O failure');
    });
});

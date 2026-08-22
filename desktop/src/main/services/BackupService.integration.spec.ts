import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { DeviceKeyStore } from './DeviceKeyStore';
import { SecurityService } from './SecurityService';
import { DatabaseService } from './DatabaseService';
import { BackupService } from './BackupService';
import type { GoogleDriveService } from './GoogleDriveService';

class BackupIntegrationStore implements DeviceKeyStore {
    constructor(private mask: number) { }
    status() { return { available: true, provider: 'backup-integration-store' }; }
    protect(value: Buffer) { return Buffer.from(value.map(byte => byte ^ this.mask)); }
    unprotect(value: Buffer) { return this.protect(value); }
}

describe.skipIf(!process.versions.electron)('BackupService SQLCipher integration', () => {
    let root: string;
    let bundle: string;
    const drive = { isAuthenticated: vi.fn(() => false), uploadFile: vi.fn() } as unknown as GoogleDriveService;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-backup-integration-'));
        bundle = path.join(root, 'external.ndbackup');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    async function vault(directory: string, store: DeviceKeyStore, value: string) {
        fs.mkdirSync(directory, { recursive: true });
        const dbPath = path.join(directory, 'nalamdesk-test.db');
        const security = new SecurityService(store);
        const recoveryCode = await security.setup('login-only', dbPath, directory);
        security.getDb().exec(`CREATE TABLE clinical_backup_test (value TEXT); INSERT INTO clinical_backup_test VALUES ('${value}')`);
        security.completeProvisioning();
        const database = new DatabaseService(); database.setDb(security.getDb());
        return { directory, dbPath, security, database, recoveryCode };
    }

    async function makeBundle(source: Awaited<ReturnType<typeof vault>>) {
        await new BackupService(source.database, drive, source.security, source.directory, { appVersion: 'integration' })
            .createBackupBundle(bundle);
    }

    function stable(value: any): string {
        if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
        if (value && typeof value === 'object') return `{${Object.keys(value).sort()
            .map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
        return JSON.stringify(value);
    }

    function corruptEncryptedDataPageAndRehash(filePath: string) {
        const bytes = fs.readFileSync(filePath);
        const magicLength = Buffer.byteLength('NALAMDESK-BACKUP\n');
        const manifestLength = bytes.readUInt32BE(magicLength);
        const manifestStart = magicLength + 4;
        const databaseStart = manifestStart + manifestLength;
        const manifest = JSON.parse(bytes.subarray(manifestStart, databaseStart).toString('utf8'));
        // The test creates a large unqueried overflow area. Corrupt its final
        // authenticated page while leaving schema/vault-binding pages readable.
        bytes[bytes.length - 100] ^= 0xff;
        manifest.database.sha256 = crypto.createHash('sha256').update(bytes.subarray(databaseStart)).digest('hex');
        const { integrity: _old, ...body } = manifest;
        manifest.integrity.manifestSha256 = crypto.createHash('sha256').update(stable(body)).digest('hex');
        const updated = Buffer.from(JSON.stringify(manifest));
        expect(updated.length).toBe(manifestLength);
        updated.copy(bytes, manifestStart);
        fs.writeFileSync(filePath, bytes);
    }

    it('restores a real SQLCipher vault on a clean machine and cold-starts with the new device envelope', async () => {
        const source = await vault(path.join(root, 'source'), new BackupIntegrationStore(0x11), 'preserved');
        await makeBundle(source); source.security.closeDb();

        const targetDirectory = path.join(root, 'target'); fs.mkdirSync(targetDirectory);
        const targetStore = new BackupIntegrationStore(0x72);
        const targetSecurity = new SecurityService(targetStore);
        const targetDatabase = new DatabaseService();
        const service = new BackupService(targetDatabase, drive, targetSecurity, targetDirectory, {
            createIsolatedSecurityService: () => new SecurityService(targetStore), onRestoreCommitted: vi.fn()
        });
        await service.restoreLocalBackup(bundle, source.recoveryCode);
        expect(targetSecurity.getDb().prepare('SELECT value FROM clinical_backup_test').get()).toEqual({ value: 'preserved' });
        targetSecurity.closeDb();

        const coldStart = new SecurityService(targetStore);
        await coldStart.initializeDevice(path.join(targetDirectory, 'nalamdesk-test.db'), targetDirectory);
        expect(coldStart.getDb().prepare('SELECT value FROM clinical_backup_test').get()).toEqual({ value: 'preserved' });
        coldStart.closeDb();
    });

    it('rejects the wrong recovery code before creating live DB or security files', async () => {
        const source = await vault(path.join(root, 'source'), new BackupIntegrationStore(0x21), 'preserved');
        await makeBundle(source); source.security.closeDb();
        const targetDirectory = path.join(root, 'target'); fs.mkdirSync(targetDirectory);
        const targetStore = new BackupIntegrationStore(0x44);
        const service = new BackupService(new DatabaseService(), drive, new SecurityService(targetStore), targetDirectory, {
            createIsolatedSecurityService: () => new SecurityService(targetStore), onRestoreCommitted: vi.fn()
        });
        await expect(service.restoreLocalBackup(bundle, 'WRONG-CODE')).rejects.toThrow('INVALID_RECOVERY_CODE');
        expect(fs.existsSync(path.join(targetDirectory, 'nalamdesk-test.db'))).toBe(false);
        expect(fs.existsSync(path.join(targetDirectory, 'security.json'))).toBe(false);
    });

    it('rejects a rehashed bundle with a corrupt unread SQLCipher page before live mutation', async () => {
        const source = await vault(path.join(root, 'source'), new BackupIntegrationStore(0x25), 'incoming');
        source.security.getDb().exec('CREATE TABLE unread_backup_pages (payload BLOB); INSERT INTO unread_backup_pages VALUES (zeroblob(1048576))');
        await makeBundle(source); source.security.closeDb();
        corruptEncryptedDataPageAndRehash(bundle);

        const targetStore = new BackupIntegrationStore(0x26);
        const current = await vault(path.join(root, 'target'), targetStore, 'current-preserved');
        const oldDatabase = fs.readFileSync(current.dbPath);
        const oldConfig = fs.readFileSync(path.join(current.directory, 'security.json'));
        const service = new BackupService(current.database, drive, current.security, current.directory, {
            createIsolatedSecurityService: () => new SecurityService(targetStore), onRestoreCommitted: vi.fn()
        });
        await expect(service.restoreLocalBackup(bundle, source.recoveryCode)).rejects
            .toThrow(/BACKUP_(CIPHER|DATABASE)_INTEGRITY_FAILED/);
        expect(fs.readFileSync(current.dbPath)).toEqual(oldDatabase);
        expect(fs.readFileSync(path.join(current.directory, 'security.json'))).toEqual(oldConfig);
        current.security.closeDb();
    });

    it('rejects recovery metadata from a different vault despite valid SQLCipher bytes', async () => {
        const second = await vault(path.join(root, 'second'), new BackupIntegrationStore(0x32), 'second');
        const wrongVaultId = '00000000-0000-4000-8000-000000000000';
        const wrongEnvelope = await (second.security as any).createRecoveryEnvelope(
            (second.security as any).dek, second.recoveryCode, wrongVaultId, 1
        );
        const mismatchedSecurity = {
            getPortableVaultMetadata: () => ({
                ...second.security.getPortableVaultMetadata(), vaultId: wrongVaultId, recovery: wrongEnvelope
            }),
            getDb: () => second.security.getDb(), getDbPath: () => second.dbPath
        } as unknown as SecurityService;
        await new BackupService(second.database, drive, mismatchedSecurity, second.directory).createBackupBundle(bundle);
        const targetDirectory = path.join(root, 'target'); fs.mkdirSync(targetDirectory);
        const targetStore = new BackupIntegrationStore(0x50);
        const service = new BackupService(new DatabaseService(), drive, new SecurityService(targetStore), targetDirectory, {
            createIsolatedSecurityService: () => new SecurityService(targetStore), onRestoreCommitted: vi.fn()
        });
        await expect(service.restoreLocalBackup(bundle, second.recoveryCode)).rejects.toThrow('VAULT_BINDING_MISMATCH');
        expect(fs.existsSync(path.join(targetDirectory, 'security.json'))).toBe(false);
        second.security.closeDb();
    });

    it('restores the prior real vault after interruption and retains a recoverable pre-restore snapshot', async () => {
        const incoming = await vault(path.join(root, 'incoming'), new BackupIntegrationStore(0x61), 'incoming');
        await makeBundle(incoming); incoming.security.closeDb();
        const targetStore = new BackupIntegrationStore(0x62);
        const current = await vault(path.join(root, 'target'), targetStore, 'current');
        const service = new BackupService(current.database, drive, current.security, current.directory, {
            createIsolatedSecurityService: () => new SecurityService(targetStore),
            onRestoreCommitted: vi.fn(),
            onStep: step => { if (step === 'restore-after-config-replace') throw new Error('forced interruption'); }
        });
        await expect(service.restoreLocalBackup(bundle, incoming.recoveryCode)).rejects.toThrow('forced interruption');
        expect(current.security.getDb().prepare('SELECT value FROM clinical_backup_test').get()).toEqual({ value: 'current' });
        const snapshots = fs.readdirSync(path.join(current.directory, 'backups')).filter(name => name.includes('pre-restore'));
        expect(snapshots).toHaveLength(1);
        current.security.closeDb();

        const recoveryDirectory = path.join(root, 'snapshot-recovery'); fs.mkdirSync(recoveryDirectory);
        const recoveryStore = new BackupIntegrationStore(0x73);
        const recoverySecurity = new SecurityService(recoveryStore);
        const recoveryDatabase = new DatabaseService();
        await new BackupService(recoveryDatabase, drive, recoverySecurity, recoveryDirectory, {
            createIsolatedSecurityService: () => new SecurityService(recoveryStore), onRestoreCommitted: vi.fn()
        }).restoreLocalBackup(path.join(current.directory, 'backups', snapshots[0]), current.recoveryCode);
        expect(recoverySecurity.getDb().prepare('SELECT value FROM clinical_backup_test').get()).toEqual({ value: 'current' });
        recoverySecurity.closeDb();
    });
});

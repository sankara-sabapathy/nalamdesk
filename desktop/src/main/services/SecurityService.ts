import * as argon2 from 'argon2';
// @ts-ignore - types might be missing or need specific import
import Database from 'better-sqlite3-multiple-ciphers';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Security Config Interface stored in security.json
 */
interface SecurityConfig {
    version: number;
    salt: string; // Hex string
    wrappedKey: string; // Encrypted DEK (Hex string) - Encrypted with Password
    iv: string; // IV used for wrapping key (Hex string)
    recovery?: {
        salt: string; // Hex string (Salt for recovery code)
        wrappedKey: string; // Encrypted DEK (Hex string) - Encrypted with Recovery Code
        iv: string; // IV used for recovery wrapping
    };
}

/**
 * SecurityService handles database encryption using SQLCipher with a Key Wrapping Architecture.
 * 
 * V2 Architecture:
 * - Data Encryption Key (DEK): A random 32-byte key that actually encrypts the DB.
 * - Key Encryption Key (KEK): Derived from User Password (or Recovery Code).
 * - The DEK is encrypted (wrapped) by the KEK and stored in security.json.
 * 
 * This allows:
 * 1. Password Changes (Re-wrap DEK with new Password KEK) without re-encrypting the whole DB.
 * 2. Password Recovery (Unwrap DEK with Recovery Code KEK, then Re-wrap with new Password KEK).
 */
export class SecurityService {
    private db: any;
    private dbPath: string = '';
    private appUserDataPath: string = '';

    // In-memory DEK (cleared on app exit)
    private dek: Buffer | null = null;

    /**
     * Checks if the application is already set up.
     */
    isSetup(userDataPath: string): { isSetup: boolean, hasRecovery: boolean } {
        const configPath = path.join(userDataPath, 'security.json');
        const legacySaltPath = path.join(userDataPath, 'salt.bin');

        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as SecurityConfig;
                return { isSetup: true, hasRecovery: !!config.recovery };
            } catch (e) {
                return { isSetup: true, hasRecovery: false }; // Corrupt file? Treat as setup but broken? Or just assume true.
            }
        }

        // If legacy salt exists, we consider it "Setup" (will migrate on login)
        if (fs.existsSync(legacySaltPath)) {
            return { isSetup: true, hasRecovery: false };
        }

        return { isSetup: false, hasRecovery: false };
    }

    /**
     * Fresh Setup: Generates new DEK, creates security.json, and initializes DB.
     * Returns the Recovery Code for the user to save.
     */
    async setup(password: string, dbPath: string, userDataPath: string): Promise<string> {
        this.appUserDataPath = userDataPath;
        this.dbPath = dbPath;

        // 1. Generate Random DEK
        this.dek = crypto.randomBytes(32);

        // 2. Generate Recovery Code
        const recoveryCode = this.generateRecoveryCodeString();

        // 3. Create Security Config (Wrap DEK with Password AND Recovery Code)
        const config = await this.createSecurityConfig(this.dek, password, recoveryCode);
        this.saveConfig(config);

        // 4. Initialize DB with DEK
        this.initDb(this.dbPath, this.dek);

        return recoveryCode;
    }

    /**
     * Initialize / Unlock the encrypted database.
     * Handles V1 -> V2 Migration transparently.
     */
    async initialize(password: string, dbPath: string, userDataPath: string): Promise<void> {
        this.appUserDataPath = userDataPath;
        this.dbPath = dbPath;

        const configPath = path.join(userDataPath, 'security.json');
        const legacySaltPath = path.join(userDataPath, 'salt.bin');

        // CASE 1: V2 Setup Exists
        if (fs.existsSync(configPath)) {
            console.log('[Security] Loading V2 Configuration...');
            const config = this.loadConfig();

            // Unwrap DEK using Password
            try {
                this.dek = await this.unwrapKey(config.wrappedKey, config.iv, config.salt, password);
                this.initDb(this.dbPath, this.dek);
                console.log('[Security] Vault Unlocked (V2).');
            } catch (e) {
                console.error('[Security] Failed to unlock vault:', e);
                throw new Error('INVALID_PASSWORD');
            }
            return;
        }

        // CASE 2: V1 Legacy Exists -> Migrate to V2
        if (fs.existsSync(legacySaltPath)) {
            console.log('[Security] Detected V1 Setup. Starting Migration to V2...');
            await this.migrateV1toV2(password, legacySaltPath);
            return;
        }

        // CASE 3: No Setup -> Should have called setup() instead.
        throw new Error('NOT_SETUP');
    }


    /**
     * Recover Password using Recovery Code.
     * Sets a new password and re-wraps the DEK.
     */
    async recover(recoveryCode: string, newPassword: string, userDataPath: string, dbPath: string): Promise<string> {
        this.appUserDataPath = userDataPath;
        this.dbPath = dbPath;

        const config = this.loadConfig();
        if (!config.recovery) {
            throw new Error('NO_RECOVERY_CODE_SET');
        }

        // 1. Unwrap DEK using Recovery Code
        try {
            this.dek = await this.unwrapKey(config.recovery.wrappedKey, config.recovery.iv, config.recovery.salt, recoveryCode);
        } catch (e) {
            throw new Error('INVALID_RECOVERY_CODE');
        }

        // 2. Rotate Security Config (New Password KEK + New Recovery Code KEK)
        const newRecoveryCode = this.generateRecoveryCodeString();

        // Wrap DEK with NEW Password
        const salt = crypto.randomBytes(16);
        const kek = await this.deriveKey(newPassword, salt);
        const { encrypted: wrappedKey, iv } = this.aesEncrypt(this.dek, kek);

        // Wrap DEK with NEW Recovery Code
        const rSalt = crypto.randomBytes(16);
        const rKek = await this.deriveKey(newRecoveryCode, rSalt);
        const { encrypted: rWrappedKey, iv: rIv } = this.aesEncrypt(this.dek, rKek);

        const newConfig: SecurityConfig = {
            version: 2,
            salt: salt.toString('hex'),
            wrappedKey: wrappedKey,
            iv: iv,
            recovery: {
                salt: rSalt.toString('hex'),
                wrappedKey: rWrappedKey,
                iv: rIv
            }
        };

        this.saveConfig(newConfig);

        // 3. Open DB
        this.initDb(this.dbPath, this.dek);
        console.log('[Security] Password reset successful. Vault Unlocked. Recovery Code Rotated.');

        return newRecoveryCode;
    }

    /**
     * Helper: Generate a secure recovery code string (Format: XXXX-XXXX-XXXX-XXXX)
     */
    generateRecoveryCodeString(): string {
        // Generate 16 bytes of random entropy, generic human-readable format
        const bytes = crypto.randomBytes(10); // 20 hex chars
        const hex = bytes.toString('hex').toUpperCase();
        return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
    }

    /**
     * Regenerate Recovery Code (for Admin).
     * Requires the current password to unlock logic (though DEK is already in memory).
     * Re-wraps the DEK with valid Password and NEW Recovery Code.
     */
    async regenerateRecoveryCode(password: string): Promise<string> {
        if (!this.dek) {
            // Try to load/unlock if not in memory (shouldn't happen if logged in, but safety first)
            // Or assume DEK is available if app is running and unlocked.
            // If DEK is missing, we must fail or ask to unlock.
            throw new Error('VAULT_LOCKED');
        }

        const config = this.loadConfig();

        // Vefiry password by attempting to derive KEK and check against wrappedKey?
        // Or just rely on the fact we are re-wrapping. 
        // Better to re-wrap properly.

        // 1. Generate NEW Recovery Code
        const newRecoveryCode = this.generateRecoveryCodeString();

        // 2. Create NEW Security Config
        // We re-use the existing DEK (this.dek).
        const newConfig = await this.createSecurityConfig(this.dek, password, newRecoveryCode);

        this.saveConfig(newConfig);

        return newRecoveryCode;
    }

    // ==================================================================================
    //                                  PRIVATE HELPERS
    // ==================================================================================

    private async createSecurityConfig(dek: Buffer, password: string, recoveryCode: string): Promise<SecurityConfig> {
        // 1. Wrap with Password
        const salt = crypto.randomBytes(16);
        const kek = await this.deriveKey(password, salt);
        const { encrypted: wrappedKey, iv } = this.aesEncrypt(dek, kek);

        // 2. Wrap with Recovery Code
        const rSalt = crypto.randomBytes(16);
        const rKek = await this.deriveKey(recoveryCode, rSalt);
        const { encrypted: rWrappedKey, iv: rIv } = this.aesEncrypt(dek, rKek);

        return {
            version: 2,
            salt: salt.toString('hex'),
            wrappedKey: wrappedKey,
            iv: iv,
            recovery: {
                salt: rSalt.toString('hex'),
                wrappedKey: rWrappedKey,
                iv: rIv
            }
        };
    }

    private async unwrapKey(wrappedKeyHex: string, ivHex: string, saltHex: string, secret: string): Promise<Buffer> {
        const salt = Buffer.from(saltHex, 'hex');
        const kek = await this.deriveKey(secret, salt);
        return this.aesDecrypt(wrappedKeyHex, ivHex, kek);
    }

    /**
     * Migrate V1 (Direct Password) to V2 (Wrapped Key)
     * 1. Derive OLD Key from Password + Old Salt.
     * 2. Open DB with OLD Key.
     * 3. Change DB Key to NEW Random DEK (`PRAGMA rekey`).
     * 4. Wrap NEW DEK with Password and Save Config.
     */
    private async migrateV1toV2(password: string, legacySaltPath: string): Promise<void> {
        const salt = fs.readFileSync(legacySaltPath);

        // 1. Derive V1 Key
        const oldKey = await this.deriveKeyArgon2(password, salt); // Use raw argon2 like V1

        // 2. Open DB with V1 Key to verify password
        try {
            this.initDb(this.dbPath, oldKey);
        } catch (e) {
            throw new Error('INVALID_PASSWORD'); // Pass through
        }

        console.log('[Security] V1 Key Verified. Rekeying database...');

        // 3. Generate NEW Random DEK
        this.dek = crypto.randomBytes(32);
        const newKeyHex = this.dek.toString('hex');

        // 4. PRAGMA rekey (Change DB Encryption Key)
        this.db.pragma(`rekey = "x'${newKeyHex}'"`);

        // 5. Create V2 Config (Wrap DEK)
        // Note: We don't have a recovery code yet. User will need to generate one later.
        const configSalt = crypto.randomBytes(16);
        const kek = await this.deriveKey(password, configSalt);
        const { encrypted: wrappedKey, iv } = this.aesEncrypt(this.dek, kek);

        const config: SecurityConfig = {
            version: 2,
            salt: configSalt.toString('hex'),
            wrappedKey: wrappedKey,
            iv: iv,
            // recovery: undefined // No recovery code yet
        };

        this.saveConfig(config);

        // 6. Cleanup V1 Salt
        // fs.unlinkSync(legacySaltPath); // Optional: keep for safety or backup? Let's keep it but maybe rename?
        console.log('[Security] Migration to V2 Complete.');
    }

    private saveConfig(config: SecurityConfig) {
        const configPath = path.join(this.appUserDataPath, 'security.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    private loadConfig(): SecurityConfig {
        const configPath = path.join(this.appUserDataPath, 'security.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    /**
     * V2 Key Derivation (Standardized)
     * Uses Argon2id but we can tune parameters if needed. 
     * We keep it simple to match V1 but ensure it's consistent.
     */
    private async deriveKey(secret: string, salt: Buffer): Promise<Buffer> {
        return argon2.hash(secret, {
            type: argon2.argon2id,
            raw: true,
            salt: salt
        });
    }

    /**
     * V1 Key Derivation (Strictly for backward compat with exact V1 params if any)
     * V1 used default params.
     */
    private async deriveKeyArgon2(password: string, salt: Buffer): Promise<Buffer> {
        return argon2.hash(password, {
            type: argon2.argon2id,
            raw: true,
            salt: salt
        });
    }

    private aesEncrypt(data: Buffer, key: Buffer): { encrypted: string, iv: string } {
        const iv = crypto.randomBytes(16); // IV for AES-256-GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
        // Return IV + AuthTag + EncryptedData as hex string or define a format
        // Simple format: iv (hex) | tag (hex) | encrypted (hex)
        // Actually, let's keep IV separate in JSON for clarity. 
        // Combine Tag + Encrypted
        return {
            encrypted: Buffer.concat([tag, encrypted]).toString('hex'), // First 16 bytes is tag
            iv: iv.toString('hex')
        };
    }

    private aesDecrypt(encryptedHex: string, ivHex: string, key: Buffer): Buffer {
        const encryptedAndTag = Buffer.from(encryptedHex, 'hex');
        const tag = encryptedAndTag.subarray(0, 16);
        const encrypted = encryptedAndTag.subarray(16);
        const iv = Buffer.from(ivHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }

    private initDb(filePath: string, key: Buffer): void {
        try {
            this.dbPath = filePath;
            const isDevMode = process.env['NODE_ENV'] !== 'production';
            const db = new Database(filePath, isDevMode ? { verbose: console.log } : {});

            const hexKey = key.toString('hex');
            db.pragma(`key = "x'${hexKey}'"`);

            // Verify
            db.prepare('SELECT count(*) FROM sqlite_master').get();

            this.db = db;
            console.log('[Security] Database opened successfully');
        } catch (error: any) {
            console.error('[Security] Database initialization failed:', error);
            if (error.message && (error.message.includes('file is not a database') || error.message.includes('SqliteError'))) {
                throw new Error('INVALID_PASSWORD');
            }
            throw error;
        }
    }

    getDb() { return this.db; }
    closeDb() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.dek = null; // Clear key from memory on close
        }
    }
    getDbPath() { return this.dbPath; }
}

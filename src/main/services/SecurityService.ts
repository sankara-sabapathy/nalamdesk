import * as argon2 from 'argon2';
// @ts-ignore - types might be missing or need specific import
import Database from 'better-sqlite3-multiple-ciphers';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * SecurityService handles database encryption using SQLCipher.
 * 
 * IMPORTANT: Do NOT modify the key derivation parameters!
 * Changing Argon2 settings will produce different keys and make existing databases unreadable.
 * 
 * Architecture:
 * - Each installation gets a unique random salt stored in salt.bin
 * - The encryption key is derived from: password + salt using Argon2id
 * - Salt file persists across app updates (stored in userData directory)
 */
export class SecurityService {
    private db: any;
    private dbPath: string = '';

    /**
     * Initialize the encrypted database.
     * - If salt.bin exists: use existing salt to derive key
     * - If salt.bin doesn't exist: generate new salt (fresh install)
     * 
     * @param password User's password (admin password for this app)
     * @param dbPath Full path to the database file
     * @param userDataPath User data directory (for storing salt.bin)
     */
    async initialize(password: string, dbPath: string, userDataPath: string): Promise<void> {
        const saltPath = path.join(userDataPath, 'salt.bin');
        let salt: Buffer;

        // 1. Check for existing salt (returning user / app update)
        if (fs.existsSync(saltPath)) {
            salt = fs.readFileSync(saltPath);
            console.log('[Security] Using existing salt from salt.bin');
        } else {
            // 2. Fresh install - generate new random salt
            console.log('[Security] Fresh install. Generating new random salt.');
            salt = crypto.randomBytes(32);

            // Ensure directory exists
            const dir = path.dirname(saltPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write salt to file
            fs.writeFileSync(saltPath, salt);
            console.log('[Security] Salt saved to:', saltPath);
        }

        // 3. Derive key from password + salt
        const key = await this.deriveKey(password, salt);

        // 4. Initialize/open the database
        this.initDb(dbPath, key);
    }

    /**
     * Derives a 32-byte encryption key from password and salt using Argon2id.
     * 
     * WARNING: Do NOT add explicit parameters (timeCost, memoryCost, etc.)!
     * The defaults must remain unchanged for backward compatibility.
     * Changing these will produce different keys and break existing databases.
     */
    async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        try {
            const key = await argon2.hash(password, {
                type: argon2.argon2id,
                raw: true,
                salt: salt
                // DO NOT ADD: hashLength, timeCost, memoryCost, parallelism
                // These must use defaults for backward compatibility
            });
            return key;
        } catch (err) {
            console.error('[Security] Error deriving key:', err);
            throw err;
        }
    }

    /**
     * Opens or creates the encrypted database.
     * Throws 'INVALID_PASSWORD' if the key is incorrect.
     */
    private initDb(filePath: string, key: Buffer): void {
        try {
            this.dbPath = filePath;

            // Only enable verbose logging in development
            const isDevMode = process.env['NODE_ENV'] !== 'production';
            const db = new Database(filePath, isDevMode ? { verbose: console.log } : {});

            // Set encryption key (SQLCipher format)
            const hexKey = key.toString('hex');
            db.pragma(`key = "x'${hexKey}'"`);

            // Verify encryption by attempting to read from the database
            // If key is wrong, this will throw "file is not a database"
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

    getDb() {
        return this.db;
    }

    closeDb() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    getDbPath() {
        return this.dbPath;
    }
}

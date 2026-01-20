import * as argon2 from 'argon2';
// @ts-ignore - types might be missing or need specific import
import Database from 'better-sqlite3-multiple-ciphers';
import * as path from 'path';

export class SecurityService {
    private db: any;
    private dbPath: string = '';

    /**
     * Derives a 32-byte key from the password using Argon2id.
     * Note: The password itself is the key source. If lost, data is lost.
     * @param password User's vault password
     */
    async deriveKey(password: string): Promise<Buffer> {
        try {
            const hash = await argon2.hash(password, {
                type: argon2.argon2id,
                raw: true,
                // Using default settings for now.
                // For distinct keys per user/install, we'd ideally use a salt.
                // But per requirements, "password is the key". 
                // We will trust argon2 defaults (random salt) for hashing, BUT
                // if argon2 uses a random salt, the output hash differs every time!
                // WE CANNOT USE RANDOM SALT if we need to open the SAME database.
                // We MUST use a deterministic salt or no salt (if allowed) or store the salt.
                // For a "Vault" where "Lost password = Lost data", storing the salt in cleartext is standard (e.g. in config or DB header).
                // Since we are generating the KEY for SQLCipher, we need the SAME KEY every time.
                // Let's use a fixed salt for this application instance or a static salt.
                // For now, I'll use a hardcoded salt to ensure determinism for the purpose of this task.
                // In production, we should generate a random salt on first install and store it in config.
                salt: Buffer.from('NalamDeskFixedSaltForDeterministicKeyGen123!', 'utf-8')
            });
            return hash;
        } catch (err) {
            console.error('Error deriving key', err);
            throw err;
        }
    }

    /**
     * Initializes the database with the provided key.
     * Throws 'INVALID_PASSWORD' if the key is incorrect.
     * @param filePath Path to the .db file
     * @param key The buffer key derived from password
     */
    initDb(filePath: string, key: Buffer): void {
        try {
            // verbose: console.log to debug queries
            this.dbPath = filePath;
            const db = new Database(filePath, { verbose: console.log });

            // Convert buffer to hex string format for PRAGMA key
            // SQLCipher with better-sqlite3-multiple-ciphers supports "key" pragma.
            // Format: "x'hex_string'"
            const hexKey = key.toString('hex');
            db.pragma(`key = "x'${hexKey}'"`);

            // Verify encryption by attempting to read from the database
            // If key is wrong, this will throw "file is not a database" or similar error
            db.prepare('SELECT count(*) FROM sqlite_master').get();

            this.db = db;
            console.log('Database opened successfully');
        } catch (error: any) {
            console.error('Database initialization failed:', error);
            // better-sqlite3 throws specific errors. "file is not a database" is common for wrong key.
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

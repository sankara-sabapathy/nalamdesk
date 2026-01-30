import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityService } from './SecurityService';

// Mock dependencies
vi.mock('argon2', () => ({
    hash: vi.fn(),
    argon2id: 2
}));

// Mock better-sqlite3-multiple-ciphers (used in app)
const mockPragma = vi.fn();
const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockClose = vi.fn();

mockPrepare.mockReturnValue({ get: mockGet });

vi.mock('better-sqlite3-multiple-ciphers', () => {
    return {
        default: class {
            pragma: any;
            prepare: any;
            close: any;
            constructor() {
                this.pragma = mockPragma;
                this.prepare = mockPrepare;
                this.close = mockClose;
            }
        }
    };
});


describe('SecurityService', () => {
    let service: SecurityService;
    let argon2: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        argon2 = await import('argon2');
        service = new SecurityService();

        // Default mock behaviors
        argon2.hash.mockResolvedValue(Buffer.from('mocked-hash-key'));
        mockGet.mockReturnValue({ 'count(*)': 1 }); // Success by default
    });

    describe('deriveKey', () => {
        it('should derive a 32-byte key using argon2id', async () => {
            const password = 'my-secret-password';
            const result = await service.deriveKey(password);

            expect(argon2.hash).toHaveBeenCalledWith(password, expect.objectContaining({
                type: 2, // argon2id
                raw: true,
                salt: expect.any(Buffer) // Ensuring salt is passed
            }));
            expect(result).toEqual(Buffer.from('mocked-hash-key'));
        });

        it('should propagate errors from argon2', async () => {
            argon2.hash.mockRejectedValue(new Error('Argon error'));
            await expect(service.deriveKey('pass')).rejects.toThrow('Argon error');
        });
    });

    describe('initDb', () => {
        const mockKey = Buffer.from('test-key');
        const dbPath = 'test.db';

        it('should initialize database with correct pragma key', () => {
            service.initDb(dbPath, mockKey);

            expect(mockPragma).toHaveBeenCalledWith(`key = "x'${mockKey.toString('hex')}'"`);
            expect(mockPrepare).toHaveBeenCalledWith('SELECT count(*) FROM sqlite_master'); // Verification query
            expect(service.getDb()).toBeDefined();
        });

        it('should throw INVALID_PASSWORD on sqlite error "file is not a database"', () => {
            // Simulate wrong password error
            mockGet.mockImplementation(() => { throw new Error('file is not a database'); });

            expect(() => service.initDb(dbPath, mockKey)).toThrow('INVALID_PASSWORD');
            expect(service.getDb()).toBeUndefined(); // Should not have set the db
        });

        it('should rethrow other errors', () => {
            mockGet.mockImplementation(() => { throw new Error('Disk full'); });
            expect(() => service.initDb(dbPath, mockKey)).toThrow('Disk full');
        });
    });

    describe('closeDb', () => {
        it('should close the database if open', () => {
            service.initDb('path', Buffer.from('key'));
            service.closeDb();
            expect(mockClose).toHaveBeenCalled();
            expect(service.getDb()).toBeNull();
        });

        it('should do nothing if db is not open', () => {
            service.closeDb();
            expect(mockClose).not.toHaveBeenCalled();
        });
    });
});

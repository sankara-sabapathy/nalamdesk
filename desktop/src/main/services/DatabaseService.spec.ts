import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseService } from './DatabaseService';

// Mock Argon2
vi.mock('argon2', () => ({
    hash: vi.fn().mockResolvedValue('hashed_password'),
    verify: vi.fn().mockImplementation(async (hash, plain) => hash === 'hashed_password' && plain === 'password')
}));

describe('DatabaseService', () => {
    let service: DatabaseService;
    let mockDb: any;
    let mockStatement: any;

    beforeEach(() => {
        mockStatement = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 })
        };

        mockDb = {
            exec: vi.fn((sql) => console.log('[Test] db.exec called:', sql ? sql.substring(0, 50) : 'null')),
            prepare: vi.fn().mockReturnValue(mockStatement),
            pragma: vi.fn(() => { console.log('[Test] db.pragma called'); return 0; }),
            transaction: vi.fn((fn) => { console.log('[Test] db.transaction called'); return fn; }),
            backup: vi.fn(),
            name: ':memory:'
        };

        service = new DatabaseService();
        service.setDb(mockDb);
    });

    describe('migrate', () => {
        it('should execute schema creation queries', () => {
            service.migrate();
            // Expect multiple exec calls for tables
            expect(mockDb.exec).toHaveBeenCalled();
            const calls = mockDb.exec.mock.calls.map((c: any) => c[0]);
            expect(calls.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
            expect(calls.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS patients'))).toBe(true);
            expect(calls.some((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS visits'))).toBe(true);
        });

        it('should handle existing column errors gracefully during migration', () => {
            mockDb.exec.mockImplementationOnce(() => { }).mockImplementationOnce(() => { throw new Error('duplicate column'); });
            expect(() => service.migrate()).not.toThrow();
        });

        it('should perform VACUUM INTO backup for file-based databases', () => {
            mockDb.name = 'test.db'; // Simulate file-based DB
            const fs = require('fs');
            vi.spyOn(fs, 'existsSync').mockReturnValue(false); // No existing backup

            service.migrate();

            expect(mockDb.prepare).toHaveBeenCalledWith('VACUUM INTO ?');
            expect(mockStatement.run).toHaveBeenCalledWith('test.db.bak');
        });

        it('should fallback to .backup() if VACUUM INTO fails', async () => {
            mockDb.name = 'test.db';
            mockDb.prepare.mockImplementation((sql: string) => {
                if (sql.includes('VACUUM INTO')) throw new Error('VACUUM failed');
                return mockStatement;
            });

            await service.migrate();

            expect(mockDb.backup).toHaveBeenCalledWith('test.db.bak');
        });
    });

    describe('User Management', () => {
        it('should save a new user with hashed password', async () => {
            const user = { username: 'test', password: 'password', role: 'admin', name: 'Test User' };

            await service.saveUser(user);

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
            expect(mockStatement.run).toHaveBeenCalledWith(expect.objectContaining({
                password: 'hashed_password',
                active: 1
            }));
        });

        it('should update an existing user', async () => {
            const user = { id: 1, username: 'test', role: 'doctor' };
            // Mock existing user check
            mockStatement.get.mockReturnValue({ id: 1, username: 'test', role: 'admin' });

            await service.saveUser(user);

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET'));
            expect(mockStatement.run).toHaveBeenCalled();
        });

        it('should validate user credentials correctly', async () => {
            mockStatement.get.mockReturnValue({
                id: 1,
                username: 'test',
                password: 'hashed_password',
                role: 'admin',
                active: 1
            });

            const result = await service.validateUser('test', 'password');
            expect(result.success).toBe(true);
            expect(result.user?.username).toBe('test');
        });

        it('should return failure for invalid password', async () => {
            mockStatement.get.mockReturnValue({
                id: 1, username: 'test', password: 'hashed_password', active: 1
            });

            // Mock verify to return false for wrong password
            const argon2 = await import('argon2');
            vi.mocked(argon2.verify).mockResolvedValueOnce(false);

            const result = await service.validateUser('test', 'wrong_password');
            expect(result.success).toBe(false);
            expect(result.error).toBe('INVALID_CREDENTIALS');
        });

        it('should return failure for inactive user', async () => {
            mockStatement.get.mockReturnValue({
                id: 1, username: 'test', password: 'hashed_password', active: 0
            });

            const result = await service.validateUser('test', 'password');
            expect(result.success).toBe(false);
            expect(result.error).toBe('ACCESS_DENIED');
        });
    });

    describe('Patient Management', () => {
        it('should save a new patient with UUID', () => {
            // Mock crypto.randomUUID
            global.crypto.randomUUID = vi.fn().mockReturnValue('mock-uuid');

            const patient = { name: 'John Doe', mobile: '123' };
            service.savePatient(patient);

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO patients'));
            expect(mockStatement.run).toHaveBeenCalledWith(expect.objectContaining({
                uuid: 'mock-uuid',
                name: 'John Doe'
            }));
        });

        it('should search patients', () => {
            service.getPatients('John');
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE name LIKE ?'));
            expect(mockStatement.all).toHaveBeenCalledWith(expect.stringContaining('John'), expect.any(String));
        });
    });

    describe('Queue Management', () => {
        it('should add patient to queue', () => {
            mockStatement.get.mockReturnValue(null); // Not already in queue
            service.addToQueue(1, 2, 999); // Patient 1, Priority 2, User 999

            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO patient_queue'));
            expect(mockStatement.run).toHaveBeenCalledWith(1, 2);
        });

        it('should throw if patient already in queue', () => {
            mockStatement.get.mockReturnValue({ id: 99 }); // Already in queue
            expect(() => service.addToQueue(1, 1, 999)).toThrow('Patient already in queue');
        });

        it('should log audit when updating queue status', () => {
            service.updateQueueStatus(1, 'in-consult', 999);
            // Check for Audit Log Insert
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
        });
    });
    describe('RBAC', () => {
        it('should get permissions for a role', () => {
            const permissions = ['perm1', 'perm2'];
            mockStatement.get.mockReturnValue({ permissions: JSON.stringify(permissions) });

            const result = service.getPermissions('doctor');
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT permissions FROM roles'));
            expect(result).toEqual(permissions);
        });

        it('should return empty array if role not found', () => {
            mockStatement.get.mockReturnValue(undefined);
            const result = service.getPermissions('unknown');
            expect(result).toEqual([]);
        });

        it('should save a role with permissions', () => {
            service.saveRole('nurse', ['perm1']);
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO roles'));
            expect(mockStatement.run).toHaveBeenCalledWith('nurse', JSON.stringify(['perm1']));
        });
    });
});

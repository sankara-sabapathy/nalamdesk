import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MIGRATIONS } from './migrations';

describe('Database Migrations', () => {
    let mockDb: any;
    let executedSql: string[];

    beforeEach(() => {
        executedSql = [];
        mockDb = {
            exec: vi.fn((sql: string) => {
                executedSql.push(sql);
            }),
            prepare: vi.fn().mockReturnValue({
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn()
            }),
            pragma: vi.fn()
        };
    });

    describe('MIGRATIONS array', () => {
        it('should have sequential version numbers starting at 1', () => {
            MIGRATIONS.forEach((migration, index) => {
                expect(migration.version).toBe(index + 1);
            });
        });

        it('should have an up function for each migration', () => {
            MIGRATIONS.forEach(migration => {
                expect(typeof migration.up).toBe('function');
            });
        });

        it('should have 6 migrations total', () => {
            expect(MIGRATIONS).toHaveLength(6);
        });
    });

    describe('Migration v1 (Baseline)', () => {
        beforeEach(() => {
            MIGRATIONS[0].up(mockDb);
        });

        it('should create settings table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS settings'))).toBe(true);
        });

        it('should create users table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
        });

        it('should create patients table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS patients'))).toBe(true);
        });

        it('should create visits table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS visits'))).toBe(true);
        });

        it('should create patient_queue table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS patient_queue'))).toBe(true);
        });

        it('should create audit_logs table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS audit_logs'))).toBe(true);
        });

        it('should add settings columns with ALTER TABLE', () => {
            // Ensures ALTER TABLE calls for backward compatibility columns
            expect(executedSql.some(sql => sql.includes('ALTER TABLE settings ADD COLUMN'))).toBe(true);
        });

        it('should define clinic_name in settings', () => {
            expect(executedSql.some(sql => sql.includes('clinic_name'))).toBe(true);
        });

        it('should define uuid in patients table', () => {
            expect(executedSql.some(sql => sql.includes('uuid'))).toBe(true);
        });

        it('should handle ALTER TABLE errors gracefully', () => {
            // When ALTER TABLE throws (column already exists), migration should not crash
            mockDb.exec.mockImplementation((sql: string) => {
                if (sql.includes('ALTER TABLE')) throw new Error('duplicate column');
            });
            expect(() => MIGRATIONS[0].up(mockDb)).not.toThrow();
        });
    });

    describe('Migration v2 (RBAC Roles)', () => {
        beforeEach(() => {
            MIGRATIONS[1].up(mockDb);
        });

        it('should create roles table', () => {
            expect(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS roles'))).toBe(true);
        });

        it('should seed roles using prepared statements', () => {
            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR IGNORE INTO roles')
            );
        });

        it('should insert 3 roles (doctor, receptionist, nurse)', () => {
            const runFn = mockDb.prepare.mock.results[0].value.run;
            expect(runFn).toHaveBeenCalledTimes(3);
        });

        it('should include doctor role with correct permissions', () => {
            const runFn = mockDb.prepare.mock.results[0].value.run;
            const doctorCall = runFn.mock.calls.find((args: any[]) => args[0].name === 'doctor');
            expect(doctorCall).toBeTruthy();
            const permissions = JSON.parse(doctorCall[0].permissions);
            expect(permissions).toContain('getPatients');
            expect(permissions).toContain('saveVisit');
            expect(permissions).toContain('getDashboardStats');
        });

        it('should include receptionist role with limited permissions', () => {
            const runFn = mockDb.prepare.mock.results[0].value.run;
            const receptionistCall = runFn.mock.calls.find((args: any[]) => args[0].name === 'receptionist');
            expect(receptionistCall).toBeTruthy();
            const permissions = JSON.parse(receptionistCall[0].permissions);
            expect(permissions).toContain('addToQueue');
            expect(permissions).not.toContain('saveVisit');
        });

        it('should include nurse role with minimal permissions', () => {
            const runFn = mockDb.prepare.mock.results[0].value.run;
            const nurseCall = runFn.mock.calls.find((args: any[]) => args[0].name === 'nurse');
            expect(nurseCall).toBeTruthy();
            const permissions = JSON.parse(nurseCall[0].permissions);
            expect(permissions).toContain('getQueue');
            expect(permissions).not.toContain('savePatient');
        });
    });

    describe('Migration v3 (Staff Fields)', () => {
        beforeEach(() => {
            MIGRATIONS[2].up(mockDb);
        });

        it('should add mobile column to users', () => {
            expect(executedSql.some(sql => sql.includes('ALTER TABLE users ADD COLUMN mobile'))).toBe(true);
        });

        it('should add email column to users', () => {
            expect(executedSql.some(sql => sql.includes('ALTER TABLE users ADD COLUMN email'))).toBe(true);
        });

        it('should add designation column to users', () => {
            expect(executedSql.some(sql => sql.includes('ALTER TABLE users ADD COLUMN designation'))).toBe(true);
        });

        it('should add password_reset_required column', () => {
            expect(executedSql.some(sql => sql.includes('password_reset_required'))).toBe(true);
        });

        it('should handle duplicate column errors gracefully', () => {
            mockDb.exec.mockImplementation(() => { throw new Error('duplicate column'); });
            expect(() => MIGRATIONS[2].up(mockDb)).not.toThrow();
        });
    });

    describe('Migration v4 (Drive & Backup Settings)', () => {
        beforeEach(() => {
            MIGRATIONS[3].up(mockDb);
        });

        it('should add drive_client_id column', () => {
            expect(executedSql.some(sql => sql.includes('drive_client_id'))).toBe(true);
        });

        it('should add drive_client_secret column', () => {
            expect(executedSql.some(sql => sql.includes('drive_client_secret'))).toBe(true);
        });

        it('should add local_backup_path column', () => {
            expect(executedSql.some(sql => sql.includes('local_backup_path'))).toBe(true);
        });
    });

    describe('Migration v5 (Backup Schedule)', () => {
        beforeEach(() => {
            MIGRATIONS[4].up(mockDb);
        });

        it('should add backup_schedule column with default', () => {
            expect(executedSql.some(sql => sql.includes('backup_schedule') && sql.includes("DEFAULT '13:00'"))).toBe(true);
        });
    });

    describe('Migration v6 (Cloud Backup Schedule)', () => {
        beforeEach(() => {
            MIGRATIONS[5].up(mockDb);
        });

        it('should add cloud_backup_schedule column with default', () => {
            expect(executedSql.some(sql => sql.includes('cloud_backup_schedule') && sql.includes("DEFAULT '13:00'"))).toBe(true);
        });
    });

    describe('Full Migration Run', () => {
        it('should run all migrations without error', () => {
            expect(() => {
                MIGRATIONS.forEach(migration => migration.up(mockDb));
            }).not.toThrow();
        });
    });
});

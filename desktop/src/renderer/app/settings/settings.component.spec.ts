/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { SettingsComponent } from './settings.component';

// Mock dependencies
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';
import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Mock Child Components
vi.mock('../shared/components/table/table.component', () => ({ SharedTableComponent: class { } }));
vi.mock('../shared/components/table/renderers/action-renderer.component', () => ({ ActionRendererComponent: class { } }));
vi.mock('../shared/components/date-picker/date-picker.component', () => ({ DatePickerComponent: class { } }));

describe('SettingsComponent Validation', () => {
    let component: SettingsComponent;
    let mockNgZone: any;
    let mockAuth: any;
    let mockData: any;

    beforeEach(() => {
        // Mock inject to return dummies
        mockAuth = {
            getUser: vi.fn(() => ({ id: 1, username: 'admin', role: 'admin' })),
            changeLoginPassword: vi.fn(), resetUserPassword: vi.fn(), rotateDeviceEnvelope: vi.fn(),
            acknowledgeRecoveryCode: vi.fn()
        };
        mockData = { invoke: vi.fn() };
        vi.mocked(inject).mockImplementation((token) => {
            if (token === AuthService) return mockAuth;
            if (token === DataService) return mockData;
            return { navigate: vi.fn() };
        });

        mockNgZone = { run: vi.fn((fn) => fn()) };
        vi.stubGlobal('alert', vi.fn());
        component = new SettingsComponent(mockNgZone);
        component.isElectron = false;
    });

    it('should validate required fields', () => {
        const errors = component.validateUser({});
        expect(errors).toContain('Username must be at least 3 characters.');
        expect(errors).toContain('Full Name is required.');
        expect(errors).toContain('Role is required.');
    });

    it('should validate username length', () => {
        expect(component.validateUser({ username: 'ab' })).toContain('Username must be at least 3 characters.');
        expect(component.validateUser({ username: 'abc', name: 'Valid', role: 'doc', password: '123456' }).length).toBe(0);
    });

    it('should validate mobile', () => {
        expect(component.validateUser({ mobile: '123' })).toContain('Mobile number must be exactly 10 digits.');
        const valid = component.validateUser({ mobile: '9876543210' });
        const hasMobileErr = valid.some(e => e.includes('Mobile'));
        expect(hasMobileErr).toBe(false);
    });

    it('runs administrator self-change through the dedicated verified workflow and clears inputs', async () => {
        mockAuth.changeLoginPassword.mockResolvedValue({ success: true });
        component.currentLoginPassword = 'current-secret';
        component.newLoginPassword = 'replacement-secret';
        component.confirmLoginPassword = 'replacement-secret';
        component.showLoginPasswordModal = true;
        await component.changeLoginPassword();
        expect(mockAuth.changeLoginPassword).toHaveBeenCalledWith('current-secret', 'replacement-secret');
        expect(component.currentLoginPassword).toBe('');
        expect(component.newLoginPassword).toBe('');
        expect(component.showLoginPasswordModal).toBe(false);
    });

    it('runs staff reset through the separate admin-confirmed workflow', async () => {
        mockAuth.resetUserPassword.mockResolvedValue({ success: true });
        component.resetTarget = { id: 2, username: 'doctor' };
        component.resetAdminPassword = 'admin-secret';
        component.resetTemporaryPassword = 'temporary-secret';
        component.resetConfirmPassword = 'temporary-secret';
        await component.resetUserPassword();
        expect(mockAuth.resetUserPassword).toHaveBeenCalledWith(2, 'admin-secret', 'temporary-secret');
        expect(component.resetAdminPassword).toBe('');
        expect(component.resetTemporaryPassword).toBe('');
    });

    it('does not put a password field into an existing user edit model', () => {
        component.editUser({ id: 1, username: 'admin', role: 'admin', name: 'Administrator' });
        expect(Object.prototype.hasOwnProperty.call(component.editingUser, 'password')).toBe(false);
    });

    it('acknowledges the exact displayed recovery code only when Done is selected', async () => {
        mockAuth.acknowledgeRecoveryCode.mockResolvedValue(undefined);
        component.showRecoveryModal = true;
        component.newRecoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        await component.closeRecoveryModal();
        expect(mockAuth.acknowledgeRecoveryCode).toHaveBeenCalledWith('AAAA-BBBB-CCCC-DDDD');
        expect(component.newRecoveryCode).toBeNull();
        expect(component.showRecoveryModal).toBe(false);
    });

    it('keeps an unacknowledged recovery code visible when confirmation fails', async () => {
        mockAuth.acknowledgeRecoveryCode.mockRejectedValue(new Error('interrupted'));
        component.showRecoveryModal = true;
        component.newRecoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        await component.closeRecoveryModal();
        expect(component.newRecoveryCode).toBe('AAAA-BBBB-CCCC-DDDD');
        expect(component.showRecoveryModal).toBe(true);
    });

    it('selects a Welcome-style restore bundle through the existing picker IPC', async () => {
        component.isElectron = true;
        (window as any).electron = {
            backup: { selectRestoreBundle: vi.fn(async () => ({
                path: '/external/clinic.ndbackup', name: 'clinic.ndbackup'
            })) }
        };
        await component.selectRestoreBundle();
        expect(component.restoreBundle).toMatchObject({ name: 'clinic.ndbackup', path: '/external/clinic.ndbackup' });
        expect(component.restoreError).toBe('');
    });

    it('restores through restoreSystemBackup with recovery code and live-vault admin auth', async () => {
        component.isElectron = true;
        component.restoreBundle = { path: '/external/clinic.ndbackup', name: 'clinic.ndbackup' };
        component.restoreRecoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        component.restoreAdminPassword = 'admin-secret';
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const restoreSystemBackup = vi.fn(async () => ({ success: true, restartRequired: true }));
        (window as any).electron = { restoreSystemBackup };
        await component.restoreLocalBackup();
        expect(restoreSystemBackup).toHaveBeenCalledWith({
            path: '/external/clinic.ndbackup',
            recoveryCode: 'AAAA-BBBB-CCCC-DDDD',
            currentAdminPassword: 'admin-secret'
        });
        expect(component.restoreRecoveryCode).toBe('');
        expect(component.restoreAdminPassword).toBe('');
    });

    it('does not invent a second restore pipeline for a live vault', async () => {
        component.isElectron = true;
        component.restoreBundle = { path: '/external/clinic.ndbackup', name: 'clinic.ndbackup' };
        component.restoreRecoveryCode = 'CODE';
        component.restoreAdminPassword = 'secret';
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const restoreSystemBackup = vi.fn(async () => ({ success: false, error: 'INVALID_ADMIN_CREDENTIAL' }));
        (window as any).electron = {
            restoreSystemBackup,
            drive: { restore: vi.fn() }
        };
        await component.restoreLocalBackup();
        expect(restoreSystemBackup).toHaveBeenCalled();
        expect((window as any).electron.drive.restore).not.toHaveBeenCalled();
        expect(component.restoreError).toContain('administrator password');
        expect(component.isRestoring).toBe(false);
    });

    it('requires a recovery code before calling restore IPC', async () => {
        component.isElectron = true;
        component.restoreBundle = { path: '/external/clinic.ndbackup', name: 'clinic.ndbackup' };
        component.restoreAdminPassword = 'secret';
        (window as any).electron = { restoreSystemBackup: vi.fn() };
        await component.restoreLocalBackup();
        expect((window as any).electron.restoreSystemBackup).not.toHaveBeenCalled();
        expect(component.restoreError).toContain('Recovery Code');
    });

    it('does not expose Welcome restore on non-Electron web sessions', async () => {
        component.isElectron = false;
        (window as any).electron = {
            backup: { selectRestoreBundle: vi.fn() },
            restoreSystemBackup: vi.fn()
        };
        await component.selectRestoreBundle();
        await component.restoreLocalBackup();
        expect((window as any).electron.backup.selectRestoreBundle).not.toHaveBeenCalled();
        expect((window as any).electron.restoreSystemBackup).not.toHaveBeenCalled();
    });
});

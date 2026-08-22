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
});

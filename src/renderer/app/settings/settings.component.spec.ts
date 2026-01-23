/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsComponent } from './settings.component';
import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Mock inject
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});

import { inject } from '@angular/core';

describe('SettingsComponent', () => {
    let component: SettingsComponent;
    let mockDataService: any;
    let mockAuthService: any;
    let mockRouter: any;
    let mockNgZone: any;

    beforeEach(() => {
        mockDataService = { invoke: vi.fn() };
        mockAuthService = { getUser: vi.fn() };
        mockRouter = { navigate: vi.fn() };
        mockNgZone = { run: vi.fn((fn) => fn()) };

        // Setup inject mock to return appropriate service based on call
        vi.mocked(inject).mockImplementation((token: any) => {
            if (token === DataService) return mockDataService;
            if (token === AuthService) return mockAuthService;
            if (token === Router) return mockRouter;
            return null;
        });

        component = new SettingsComponent(mockNgZone);
    });

    it('should redirect if user is not admin', () => {
        mockAuthService.getUser.mockReturnValue({ role: 'doctor' });
        component.ngOnInit();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should load settings if user is admin', () => {
        mockAuthService.getUser.mockReturnValue({ role: 'admin' });
        mockDataService.invoke.mockResolvedValue({ clinic_name: 'My Clinic' });

        component.ngOnInit();

        expect(mockDataService.invoke).toHaveBeenCalledWith('getSettings');
        // Wait for promise resolution (ngOnInit is not async but calls async)
        // In unit test without TestBed, we might need to wait manually or trust mock resolution
        // The component uses .then or await. If ngOnInit is sync, we can't await it directly if it doesn't return promise.
        // Let's check component implementation. It calls loadSettings() which is async.
    });

    it('should save settings', async () => {
        component.settings = { clinic_name: 'New Name' };
        await component.saveSettings();

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveSettings', { clinic_name: 'New Name' });
        expect(component.settingsSaved).toBe(true);
    });

    it('should add a new user', async () => {
        component.editingUser = { username: 'dr_house', password: 'vicodin', role: 'doctor' };

        await component.saveUser();

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveUser', expect.objectContaining({ username: 'dr_house' }));
        expect(component.editingUser).toBeNull(); // Should reset
    });

    it('should validation user creation', async () => {
        component.editingUser = { username: '' }; // Invalid
        await component.saveUser();
        expect(mockDataService.invoke).not.toHaveBeenCalled();
    });
});

/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, xdescribe, it, expect, vi, beforeEach } from 'vitest';
import { NavbarComponent } from './navbar.component';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

// Mock inject/core
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';

describe('NavbarComponent', () => {
    let component: NavbarComponent;
    let mockRouter: any;
    let mockNgZone: any;
    let mockDataService: any;
    let mockAuthService: any;

    beforeEach(() => {
        mockRouter = { navigate: vi.fn() };
        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockDataService = { invoke: vi.fn().mockReturnValue(Promise.resolve({ clinic_name: 'Test Clinic' })) };
        mockAuthService = { getUser: vi.fn().mockReturnValue({ name: 'Dr. Test', role: 'doctor' }), logout: vi.fn() };

        // Mock inject implementation
        vi.mocked(inject).mockImplementation((token: any) => {
            if (token === DataService) return mockDataService;
            if (token === AuthService) return mockAuthService;
            return null;
        });

        component = new NavbarComponent(mockRouter, mockNgZone);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should toggle mobile menu', () => {
        expect(component.isMobileMenuOpen).toBe(false);
        component.toggleMobileMenu();
        expect(component.isMobileMenuOpen).toBe(true);
        component.toggleMobileMenu();
        expect(component.isMobileMenuOpen).toBe(false);
    });

    it('should close mobile menu immediately', () => {
        component.isMobileMenuOpen = true;
        component.closeMobileMenu();
        expect(component.isMobileMenuOpen).toBe(false);
    });

    it('should load clinic name on init', async () => {
        // ngOnInit calls loadSettings (async but not awaited)
        component.ngOnInit();
        // Wait for promise resolution
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(component.clinicName).toBe('Test Clinic');
    });
});

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

    beforeEach(() => {
        // Mock inject to return dummies
        vi.mocked(inject).mockImplementation((token) => {
            return { invoke: vi.fn(), getUser: vi.fn(), navigate: vi.fn() };
        });

        mockNgZone = { run: vi.fn((fn) => fn()) };
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
        expect(component.validateUser({ username: 'abc', name: 'Valid', role: 'doc', password: '1234' }).length).toBe(0);
    });

    it('should validate mobile', () => {
        expect(component.validateUser({ mobile: '123' })).toContain('Mobile number must be exactly 10 digits.');
        const valid = component.validateUser({ mobile: '9876543210' });
        const hasMobileErr = valid.some(e => e.includes('Mobile'));
        expect(hasMobileErr).toBe(false);
    });
});

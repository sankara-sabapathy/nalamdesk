import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('NavbarComponent', () => {
    let component: NavbarComponent;
    let fixture: ComponentFixture<NavbarComponent>;
    let mockRouter: any;
    let mockDataService: any;
    let mockAuthService: any;

    beforeEach(async () => {
        mockRouter = { navigate: vi.fn() };
        mockDataService = { invoke: vi.fn().mockReturnValue(Promise.resolve({ clinic_name: 'Test Clinic' })) };
        mockAuthService = { getUser: vi.fn().mockReturnValue({ name: 'Dr. Test', role: 'doctor' }), logout: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [NavbarComponent],
            providers: [
                { provide: Router, useValue: mockRouter },
                { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
                { provide: DataService, useValue: mockDataService },
                { provide: AuthService, useValue: mockAuthService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(NavbarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
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
        await component.loadSettings();
        expect(component.clinicName).toBe('Test Clinic');
    });
});

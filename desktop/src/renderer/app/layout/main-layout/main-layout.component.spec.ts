import { MainLayoutComponent } from './main-layout.component';
import { vi, describe, xdescribe, it, expect, beforeEach } from 'vitest';

describe('MainLayoutComponent', () => {
    let component: MainLayoutComponent;
    let mockAuthService: any;
    let mockRouter: any;
    let mockDialogService: any;

    beforeEach(() => {
        mockAuthService = {
            logout: vi.fn(),
            getUser: vi.fn().mockReturnValue({ name: 'Dr. Test', role: 'doctor' })
        };

        mockRouter = {
            navigate: vi.fn(),
            url: '/dashboard'
        };

        mockDialogService = {
            options: vi.fn().mockReturnValue({ type: 'info' }), // Signal mock is a function
            isOpen: vi.fn().mockReturnValue(false),
            close: vi.fn(),
            confirm: vi.fn()
        };

        component = new MainLayoutComponent(mockRouter, mockDialogService, mockAuthService);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have user details', () => {
        expect(component.currentUser.name).toBe('Dr. Test');
    });

    it('should logout', () => {
        component.logout();
        expect(mockAuthService.logout).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
});

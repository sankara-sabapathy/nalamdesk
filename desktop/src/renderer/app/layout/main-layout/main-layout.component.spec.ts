import { MainLayoutComponent } from './main-layout.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import { NavigationStart, NavigationEnd } from '@angular/router';

describe('MainLayoutComponent', () => {
    let component: MainLayoutComponent;
    let mockAuthService: any;
    let mockRouter: any;
    let mockDialogService: any;
    let mockNgZone: any;
    let mockRuntimeService: any;

    beforeEach(() => {
        mockAuthService = {
            logout: vi.fn(),
            getUser: vi.fn().mockReturnValue({ name: 'Dr. Test', role: 'doctor' })
        };

        mockRouter = {
            navigate: vi.fn(),
            url: '/dashboard',
            events: { subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) }
        };

        mockDialogService = {
            options: vi.fn().mockReturnValue({ type: 'info' }), // Signal mock is a function
            isOpen: vi.fn().mockReturnValue(false),
            close: vi.fn(),
            confirm: vi.fn()
        };

        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockRuntimeService = {
            init: vi.fn().mockResolvedValue(undefined),
            lanAccessUrl: '',
        };

        component = new MainLayoutComponent(
            mockRouter,
            mockDialogService,
            mockAuthService,
            mockNgZone,
            mockRuntimeService
        );
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have user details', () => {
        expect(component.currentUser.name).toBe('Dr. Test');
    });

    it('should close drawer if open', () => {
        // Mock ElementRef for drawerCheckbox
        const mockCheckbox = {
            nativeElement: { checked: true }
        };
        component.drawerCheckbox = mockCheckbox as any;

        component.closeDrawer();

        expect(mockCheckbox.nativeElement.checked).toBe(false);
    });

    it('should logout', () => {
        component.logout();
        expect(mockAuthService.logout).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('clears the shell error when a child route starts', () => {
        const events = new Subject();
        mockRouter.events = events;
        const layout = new MainLayoutComponent(
            mockRouter,
            mockDialogService,
            mockAuthService,
            mockNgZone,
            mockRuntimeService
        );
        layout.ngOnInit();
        events.next(new NavigationStart(1, '/visits'));
        expect(mockDialogService.close).toHaveBeenCalled();
        mockDialogService.close.mockClear();
        events.next(new NavigationEnd(1, '/visits', '/visits'));
        expect(mockDialogService.close).not.toHaveBeenCalled();
        layout.ngOnDestroy();
    });
});

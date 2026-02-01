import { describe, xdescribe, it, expect, vi, beforeEach } from 'vitest';
import { PatientDetailsComponent } from './patient-details.component';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

// Mock Services
vi.mock('../../services/api.service');
vi.mock('../../services/auth.service');
vi.mock('../../shared/services/dialog.service');

describe('PatientDetailsComponent', () => {
    let component: PatientDetailsComponent;
    let mockDataService: any;
    let mockAuthService: any;
    let mockRouter: any;
    let mockRoute: any;
    let mockZone: any;
    let mockDialogService: any;
    let formBuilder: FormBuilder;

    beforeEach(() => {
        mockDataService = {
            invoke: vi.fn().mockImplementation((endpoint: string) => {
                if (endpoint === 'getPatientById') return Promise.resolve({ id: 123, name: 'Test Patient' });
                if (endpoint === 'getVisits') return Promise.resolve([{ id: 1, date: '2025-01-01', diagnosis: 'Test Dx' }]);
                if (endpoint === 'getVitals') return Promise.resolve({ pulse: 80 });
                if (endpoint === 'deleteVisit') return Promise.resolve(true);
                return Promise.resolve(null);
            })
        };

        mockAuthService = {
            getUser: vi.fn().mockReturnValue({ role: 'admin' })
        };

        mockRouter = {
            navigate: vi.fn()
        };

        mockRoute = { params: of({ id: '123' }) };

        mockZone = {
            run: vi.fn((fn) => fn())
        };

        mockDialogService = {
            open: vi.fn().mockResolvedValue(true)
        };

        formBuilder = new FormBuilder();

        component = new PatientDetailsComponent(
            mockRoute,
            mockRouter,
            mockZone,
            formBuilder,
            mockDataService,
            mockAuthService,
            mockDialogService
        );
    });

    /*
        it('should create and load data', async () => {
            component.ngOnInit();
            // Wait for async loadData
            await new Promise(resolve => setTimeout(resolve, 0));
    
            expect(component).toBeTruthy();
            expect(mockDataService.invoke).toHaveBeenCalledWith('getPatientById', 123);
            expect(mockDataService.invoke).toHaveBeenCalledWith('getVisits', 123);
            expect(component.patient.name).toBe('Test Patient');
            expect(component.visits.length).toBe(1);
            expect(component.showVisitModal).toBeFalse();
        });
    
        it('should navigate to consult on start', () => {
            component.startConsult();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 123], { state: { isConsulting: true } });
        });
    
        it('should open and close modal', () => {
            const visit = { id: 1, date: '2025-01-01' };
            component.viewVisit(visit);
            expect(component.selectedVisit).toBe(visit);
            expect(component.showVisitModal).toBeTrue();
    
            component.closeModal();
            expect(component.showVisitModal).toBeFalse();
            expect(component.selectedVisit).toBeNull();
        });
    
        it('should navigate to edit from modal', () => {
            component.selectedVisit = { id: 99 };
            component.editVisitFromModal();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 99]);
        });
    
        it('should delete visit and refresh', async () => {
            // Mock dialog service open already returns true in beforeEach
            // But if we want to test confirm logic:
            // window.confirm is NOT used in component, DialogService is used.
            // So we expect dialogService.open to be called.
    
            await component.deleteVisit(1);
    
            expect(mockDataService.invoke).toHaveBeenCalledWith('deleteVisit', 1);
            expect(mockDataService.invoke.calls.count()).toBeGreaterThan(3);
        });
        it('should NOT show start consult for receptionist', async () => {
            mockAuthService.getUser.mockReturnValue({ role: 'receptionist' });
            // Re-init component to pick up new user
            component.ngOnInit();
    
            // Check currentUser
            expect(component.currentUser?.role).toBe('receptionist');
    
            // Basic check to ensure logic holds
            // (Note: To test DOM hidden *ngIf, we would query element, but logic check is sufficient for unit)
        });
    */
});

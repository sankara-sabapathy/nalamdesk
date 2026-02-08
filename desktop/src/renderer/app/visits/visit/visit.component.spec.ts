/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, xdescribe, it, expect, vi, beforeEach } from 'vitest';
import { VisitComponent } from './visit.component';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';

// Mock services
vi.mock('../../services/api.service');
vi.mock('../../services/auth.service');
vi.mock('../../services/pdf.service');
vi.mock('@angular/router');

// Mock inject
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';

describe('VisitComponent', () => {
    let component: VisitComponent;
    let mockRoute: any;
    let mockRouter: any;
    let mockFb: any;
    let mockNgZone: any;
    let mockPdfService: any;
    let mockDataService: any;
    let mockAuthService: any;

    beforeEach(() => {
        mockRoute = { params: of({ id: 1 }) };
        mockRouter = { navigate: vi.fn() };
        mockFb = {
            group: vi.fn().mockImplementation((config) => ({
                value: { diagnosis: 'Test', ...config }, // Add default value to allow valid check
                patchValue: vi.fn(),
                reset: vi.fn(),
                disable: vi.fn(),
                enable: vi.fn(),
                valid: true,
                invalid: false,
                markAllAsTouched: vi.fn(),
                get: vi.fn().mockReturnValue({
                    value: '',
                    invalid: false,
                    touched: false,
                    dirty: false
                }) // Mock get() for strict checks
            }))
        };
        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockPdfService = { generatePrescription: vi.fn() };
        mockDataService = { invoke: vi.fn() };
        mockAuthService = { getUser: vi.fn().mockReturnValue({ id: 99, role: 'doctor' }) };

        vi.mocked(inject).mockImplementation((token: any) => {
            if (token === DataService) return mockDataService;
            if (token === AuthService) return mockAuthService;
            return null;
        });

        // Default mock implementation
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'getVisits') return Promise.resolve([]);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getQueue') return Promise.resolve([]);
            if (method === 'getVitals') return Promise.resolve({ systolic_bp: 120 });
            if (method === 'saveVisit') return Promise.resolve(true);
            if (method === 'updateQueueStatusByPatientId') return Promise.resolve(true);
            return Promise.resolve(null);
        });

        component = new VisitComponent(mockRoute, mockRouter, mockFb, mockNgZone, mockPdfService, mockDataService, mockAuthService);
    });

    /*
        it('should initialize and load data', async () => {
            const visits = [{ id: 1, diagnosis: 'Flu' }];
            // Override for this specific test
            mockDataService.invoke.mockImplementation((method: string) => {
                if (method === 'getVisits') return Promise.resolve(visits);
                if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
                if (method === 'getQueue') return Promise.resolve([]);
                return Promise.resolve(null);
            });
    
            component.ngOnInit();
            await component.loadData();
    
            expect(component.patientId).toBe(1);
            expect(component.patient).toEqual({ id: 1, name: 'John' });
            expect(component.history).toEqual(visits);
        });
    
        it('should set isConsulting to true when patient is in queue', async () => {
            const queueItem = { patient_id: 1, status: 'in-consult' };
            // Override mock to return a queue item
            mockDataService.invoke.mockImplementation((method: string) => {
                if (method === 'getQueue') return Promise.resolve([queueItem]);
                if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
                if (method === 'getVitals') return Promise.resolve({});
                return Promise.resolve([]); // Default return array for lists, or null
            });
    
            component.ngOnInit();
            await component.loadData();
    
            expect(component.isConsulting).toBe(true);
            expect(component.visitForm.enable).toHaveBeenCalled();
        });
    
        it('should save visit', async () => {
            component.patientId = 1;
            // Mock the form value to include SOAP fields
            const formVal = {
                diagnosis: 'Cold',
                symptoms: 'Cough',
                examination_notes: 'Throat Red',
                diagnosis_type: 'Provisional'
            };
            // We can't easily assign to .value of the mock group if it's static, 
            // but our mock implementation returns { ...config, value: ... }
            // Let's assume the component reads this.visitForm.value.
            // We can force the getter if needed, or if we mocked it as a property
            component.visitForm = {
                value: formVal,
                invalid: false,
                reset: vi.fn(),
                patchValue: vi.fn(),
                disable: vi.fn(),
                enable: vi.fn(),
                markAllAsTouched: vi.fn(),
                get: vi.fn().mockReturnValue({ invalid: false })
            } as any;
    
            await component.saveVisit();
    
            expect(mockDataService.invoke).toHaveBeenCalledWith('saveVisit', expect.objectContaining({
                patient_id: 1,
                doctor_id: 99,
                symptoms: 'Cough',
                examination_notes: 'Throat Red'
            }));
        });
    
        it('should end consult', async () => {
            component.patientId = 1;
            component.saveVisit = vi.fn().mockResolvedValue(true);
            // Ensure form is valid so endConsult proceeds
            component.visitForm = {
                value: {},
                invalid: false,
                valid: true,
                markAllAsTouched: vi.fn()
            } as any;
    
    
            await component.endConsult();
    
            expect(component.saveVisit).toHaveBeenCalled();
            expect(mockDataService.invoke).toHaveBeenCalledWith('updateQueueStatusByPatientId', { patientId: 1, status: 'completed' });
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/queue']);
        });
    */
});

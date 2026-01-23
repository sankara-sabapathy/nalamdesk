/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
                markAllAsTouched: vi.fn()
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
            if (method === 'saveVisit') return Promise.resolve(true);
            if (method === 'updateQueueStatusByPatientId') return Promise.resolve(true);
            return Promise.resolve(null);
        });

        component = new VisitComponent(mockRoute, mockRouter, mockFb, mockNgZone, mockPdfService);
    });

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

    it('should save visit', async () => {
        component.patientId = 1;
        component.visitForm.value.diagnosis = 'Cold'; // Force value

        await component.saveVisit();

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveVisit', expect.objectContaining({
            patient_id: 1,
            doctor_id: 99
        }));
    });

    it('should end consult', async () => {
        component.patientId = 1;
        component.saveVisit = vi.fn().mockResolvedValue(true);

        await component.endConsult();

        expect(component.saveVisit).toHaveBeenCalled();
        expect(mockDataService.invoke).toHaveBeenCalledWith('updateQueueStatusByPatientId', { patientId: 1, status: 'completed' });
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/queue']);
    });
});

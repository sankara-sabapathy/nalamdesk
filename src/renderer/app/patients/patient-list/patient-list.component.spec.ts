/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatientListComponent } from './patient-list.component';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

// Mock inject
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject } from '@angular/core';

describe('PatientListComponent', () => {
    let component: PatientListComponent;
    let mockPatientService: any;
    let mockNgZone: any;
    let mockRouter: any;
    let mockDataService: any;
    let mockAuthService: any;

    beforeEach(() => {
        mockPatientService = {
            getPatients: vi.fn().mockResolvedValue([]),
            savePatient: vi.fn().mockResolvedValue({ id: 1 })
        };
        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockRouter = { navigate: vi.fn() };
        mockDataService = { invoke: vi.fn() };
        mockAuthService = { getUser: vi.fn().mockReturnValue({ role: 'admin' }) };

        vi.mocked(inject).mockImplementation((token: any) => {
            if (token === DataService) return mockDataService;
            if (token === AuthService) return mockAuthService;
            return null;
        });

        component = new PatientListComponent(mockPatientService, mockNgZone, mockRouter);
    });

    it('should load patients on init', async () => {
        const patients = [{ id: 1, name: 'John', mobile: '123' }];
        mockPatientService.getPatients.mockResolvedValue(patients);
        mockDataService.invoke.mockResolvedValue([]); // Queue status

        await component.ngOnInit();
        // Since loadPatients is called in ngOnInit, but async, we might need to wait.
        // However, ngOnInit calls loadPatients which calls getPatients.
        // getPatients is verified.
        // But ngOnInit is NOT awaited by test runner.
        // So we wait for macro task or call methods directly.
        await component.loadPatients();

        expect(component.patients).toEqual(patients);
        expect(mockPatientService.getPatients).toHaveBeenCalledWith('');
    });

    it('should search patients', async () => {
        component.searchQuery = 'Doe';
        await component.onSearch();
        expect(mockPatientService.getPatients).toHaveBeenCalledWith('Doe');
    });

    it('should add patient to queue', async () => {
        const patient = { id: 1, name: 'John', mobile: '123' } as any;
        await component.addToQueue(patient);

        expect(mockDataService.invoke).toHaveBeenCalledWith('addToQueue', { patientId: 1, priority: 1 });
        expect(component.isEnqueued(patient)).toBe(true);
    });

    it('should not add to queue if already enqueued', async () => {
        const patient = { id: 1 } as any;
        component.enqueuedPatientIds.add(1);
        await component.addToQueue(patient);
        expect(mockDataService.invoke).not.toHaveBeenCalled();
    });

    it('should open modal for new patient', () => {
        component.openAddModal();
        expect(component.showModal).toBe(true);
        expect(component.newPatient.name).toBe('');
    });

    it('should edit patient', () => {
        const patient = { id: 1, name: 'John' } as any;
        component.editPatient(patient);
        expect(component.showModal).toBe(true);
        expect(component.newPatient).toEqual(patient);
    });
});

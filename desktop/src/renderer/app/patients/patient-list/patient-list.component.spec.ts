/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatientListComponent } from './patient-list.component';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

// Mock inject
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});
import { inject, ChangeDetectorRef } from '@angular/core';

describe('PatientListComponent', () => {
    let component: PatientListComponent;
    let mockPatientService: any;
    let mockNgZone: any;
    let mockRouter: any;
    let mockDataService: any;
    let mockAuthService: any;
    let mockCdr: any;
    let mockRoute: any;
    let realFb: FormBuilder;

    beforeEach(() => {
        mockPatientService = {
            getPatients: vi.fn().mockResolvedValue([]),
            savePatient: vi.fn().mockResolvedValue({ id: 1 }),
            isPatientComplete: vi.fn().mockReturnValue(true) // Added mock
        };
        mockNgZone = { run: vi.fn((fn) => fn()) };
        mockRouter = { navigate: vi.fn() };
        mockDataService = { invoke: vi.fn() };
        mockAuthService = { getUser: vi.fn().mockReturnValue({ role: 'admin' }) };
        mockCdr = { detectChanges: vi.fn() };
        mockRoute = { queryParams: of({}) }; // Added mock Route

        // Use REAL FormBuilder
        realFb = new FormBuilder();

        vi.mocked(inject).mockImplementation((token: any) => {
            if (token === DataService) return mockDataService;
            if (token === AuthService) return mockAuthService;
            if (token === ChangeDetectorRef) return mockCdr;
            return null;
        });

        component = new PatientListComponent(realFb, mockPatientService, mockNgZone, mockRouter, mockCdr, mockRoute);
        // Manually trigger form init since it's typically called in constructor or ngOnInit
        // In this component it is called in constructor.
    });

    it('should load patients on init', async () => {
        const patients = [{ id: 1, name: 'John', mobile: '123' }];
        mockPatientService.getPatients.mockResolvedValue(patients);
        mockDataService.invoke.mockResolvedValue([]); // Queue status

        await component.ngOnInit();
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
        expect(component.patientForm.get('name')?.value).toBeNull();
    });

    it('should edit patient', () => {
        const patient = { id: 1, name: 'John', mobile: '1234567890', age: 30, gender: 'Male' } as any; // valid data
        component.editPatient(patient);
        expect(component.showModal).toBe(true);
        expect(component.patientForm.get('name')?.value).toBe('John');
        // Verify isEditMode relies on ID being set
        expect(component.isEditMode).toBe(true);
    });

    it('should calculate minDate as 110 years ago', () => {
        const minDate = component.minDate;
        const currentYear = new Date().getFullYear();
        const minYear = new Date(minDate).getFullYear();
        expect(currentYear - minYear).toBe(110);
    });

    it('should return today date string', () => {
        const today = new Date().toISOString().split('T')[0];
        expect(component.today).toBe(today);
    });

    // We can now test real validation!
    it('should validate max age', () => {
        const ageControl = component.patientForm.get('age');

        // Valid age
        ageControl?.setValue(50);
        expect(ageControl?.valid).toBe(true);

        // Invalid age (> 110)
        ageControl?.setValue(111);
        expect(ageControl?.hasError('max')).toBe(true);
    });

    // Delete Modal Tests
    it('should open delete modal independent of edit modal', () => {
        // Ensure edit modal is closed
        component.showModal = false;

        component.confirmDelete(1);

        expect(component.showDeleteModal).toBe(true);
        expect(component.patientToDeleteId).toBe(1);
        // Verify independence
        expect(component.showModal).toBe(false);
    });

    it('should cancel delete', () => {
        component.confirmDelete(1);
        component.cancelDelete();

        expect(component.showDeleteModal).toBe(false);
        expect(component.patientToDeleteId).toBeNull();
    });

    it('should execute delete', async () => {
        component.confirmDelete(1);
        await component.executeDelete();

        expect(mockDataService.invoke).toHaveBeenCalledWith('deletePatient', 1);
        expect(component.showDeleteModal).toBe(false);
        expect(component.patientToDeleteId).toBeNull();
        expect(mockPatientService.getPatients).toHaveBeenCalled(); // Reloads list
    });
});

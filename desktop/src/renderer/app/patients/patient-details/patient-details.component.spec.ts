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
                if (endpoint === 'getQueue') return Promise.resolve([{ id: 50, patient_id: 123, status: 'waiting' }]);
                if (endpoint === 'beginConsultation') return Promise.resolve({ id: 70, patient_id: 123 });
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

    it('should create and load data', async () => {
        component.ngOnInit();
        // Wait for async loadData
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(component).toBeTruthy();
        expect(mockDataService.invoke).toHaveBeenCalledWith('getPatientById', 123);
        expect(mockDataService.invoke).toHaveBeenCalledWith('getVisits', 123);
        expect(component.patient.name).toBe('Test Patient');
        expect(component.visits.length).toBe(1);
        expect(component.showVisitModal).toBe(false);
    });

    it('should create the encounter before navigating to consult', async () => {
        component.patientId = 123;
        await component.startConsult();
        expect(mockDataService.invoke).toHaveBeenCalledWith('beginConsultation', expect.objectContaining({
            patientId: 123,
            queueEntryId: 50,
            startRequestId: expect.any(String)
        }));
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 123], {
            state: { isConsulting: true, encounterId: 70 }
        });
    });

    it('adds a missing queue entry then begins consultation', async () => {
        let queued = false;
        mockDataService.invoke.mockImplementation((endpoint: string) => {
            if (endpoint === 'getQueue') {
                return Promise.resolve(queued ? [{ id: 50, patient_id: 123, status: 'waiting' }] : []);
            }
            if (endpoint === 'addToQueue') {
                queued = true;
                return Promise.resolve({ lastInsertRowid: 50 });
            }
            if (endpoint === 'beginConsultation') return Promise.resolve({ id: 70, patient_id: 123 });
            return Promise.resolve(null);
        });
        component.patientId = 123;
        await component.startConsult();
        expect(mockDataService.invoke).toHaveBeenCalledWith('addToQueue', { patientId: 123, priority: 1 });
        expect(mockDataService.invoke).toHaveBeenCalledWith('beginConsultation', expect.objectContaining({
            patientId: 123,
            queueEntryId: 50,
            startRequestId: expect.any(String)
        }));
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 123], {
            state: { isConsulting: true, encounterId: 70 }
        });
    });

    it('surfaces start consultation failures in the in-app dialog instead of alert', async () => {
        mockDataService.invoke.mockImplementation((endpoint: string) => {
            if (endpoint === 'getQueue') return Promise.resolve([]);
            if (endpoint === 'addToQueue') return Promise.reject(new Error('Internal server error'));
            return Promise.resolve(null);
        });
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        component.patientId = 123;
        await component.startConsult();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(mockDialogService.open).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            title: 'Error'
        }));
        expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should open and close modal', () => {
        const visit = { id: 1, date: '2025-01-01' };
        component.viewVisit(visit);
        expect(component.selectedVisit).toBe(visit);
        expect(component.showVisitModal).toBe(true);

        component.closeModal();
        expect(component.showVisitModal).toBe(false);
        expect(component.selectedVisit).toBeNull();
    });

    it('should navigate to edit from modal', () => {
        component.selectedVisit = { id: 99 };
        component.editVisitFromModal();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 99]);
    });


    it('should delete visit and refresh', async () => {
        component.patientId = 123;
        await component.deleteVisit(1);

        expect(mockDataService.invoke).toHaveBeenCalledWith('deleteVisit', 1);
        expect(mockDataService.invoke).toHaveBeenCalledWith('getVisits', 123);
    });
    it('should NOT show start consult for receptionist', async () => {
        mockAuthService.getUser.mockReturnValue({ role: 'receptionist' });
        // Re-init component to pick up new user
        component.ngOnInit();

        // Check currentUser
        expect(component.currentUser?.role).toBe('receptionist');
    });

    it('suppresses malformed vitals and identifies absent observations', () => {
        expect(component.hasBp(null)).toBe(false);
        expect(component.hasBp({})).toBe(false);
        expect(component.hasBp({ systolic_bp: 120 })).toBe(false);
        expect(component.hasBp({ diastolic_bp: 80 })).toBe(false);
        expect(component.hasBp({ systolic_bp: 120, diastolic_bp: 80 })).toBe(true);

        expect(component.hasVitalsToDisplay(null)).toBe(false);
        expect(component.hasVitalsToDisplay({})).toBe(false);
        expect(component.hasVitalsToDisplay({ pulse: 80 })).toBe(true);

        expect(component.isVitalPresent(null)).toBe(false);
        expect(component.isVitalPresent(undefined)).toBe(false);
        expect(component.isVitalPresent('')).toBe(false);
        expect(component.isVitalPresent(NaN)).toBe(false);
        expect(component.isVitalPresent(0)).toBe(true);
        expect(component.isVitalPresent(80)).toBe(true);
    });

    it('loads clinical safety context, allergies, conditions, and medications', async () => {
        const mockSafetyContext = {
            patient_id: 123,
            allergies: [{ id: 1, substance: 'Penicillin', criticality: 'high', status: 'active' }],
            active_allergies: [{ id: 1, substance: 'Penicillin', criticality: 'high', status: 'active' }],
            has_active_allergies: true,
            has_life_threatening_allergies: true,
            conditions: [{ id: 1, condition_name: 'Hypertension', clinical_status: 'active' }],
            active_conditions: [{ id: 1, condition_name: 'Hypertension', clinical_status: 'active' }],
            medications: [{ id: 1, medicine_name: 'Amlodipine', status: 'active' }],
            active_medications: [{ id: 1, medicine_name: 'Amlodipine', status: 'active' }]
        };
        mockDataService.invoke.mockImplementation((endpoint: string) => {
            if (endpoint === 'getPatientById') return Promise.resolve({ id: 123, name: 'Test Patient' });
            if (endpoint === 'getVisits') return Promise.resolve([]);
            if (endpoint === 'getVitals') return Promise.resolve(null);
            if (endpoint === 'getPatientSafetyContext') return Promise.resolve(mockSafetyContext);
            return Promise.resolve(null);
        });

        component.ngOnInit();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(component.safetyContext).toEqual(mockSafetyContext);
        expect(component.allergies.length).toBe(1);
        expect(component.conditions.length).toBe(1);
        expect(component.medications.length).toBe(1);
        expect(component.safetyContext.has_active_allergies).toBe(true);
    });

    it('manages allergies lifecycle (add and delete)', async () => {
        component.patientId = 123;
        component.openAddAllergyModal();
        expect(component.showAllergyModal).toBe(true);

        component.allergyForm.patchValue({
            substance: 'Amoxicillin',
            criticality: 'high',
            severity: 'severe',
            reaction: 'Anaphylaxis'
        });

        await component.saveAllergy();
        expect(mockDataService.invoke).toHaveBeenCalledWith('saveAllergy', expect.objectContaining({
            substance: 'Amoxicillin',
            patient_id: 123
        }));
        expect(component.showAllergyModal).toBe(false);

        await component.deleteAllergy(10);
        expect(mockDataService.invoke).toHaveBeenCalledWith('deleteAllergy', 10);
    });

    it('manages conditions lifecycle (add and delete)', async () => {
        component.patientId = 123;
        component.openAddConditionModal();
        expect(component.showConditionModal).toBe(true);

        component.conditionForm.patchValue({
            condition_name: 'Type 2 Diabetes',
            code: 'E11.9',
            clinical_status: 'active'
        });

        await component.saveCondition();
        expect(mockDataService.invoke).toHaveBeenCalledWith('saveCondition', expect.objectContaining({
            condition_name: 'Type 2 Diabetes',
            patient_id: 123
        }));
        expect(component.showConditionModal).toBe(false);

        await component.deleteCondition(20);
        expect(mockDataService.invoke).toHaveBeenCalledWith('deleteCondition', 20);
    });

    it('manages medications lifecycle (add and delete)', async () => {
        component.patientId = 123;
        component.openAddMedicationModal();
        expect(component.showMedicationModal).toBe(true);

        component.medicationForm.patchValue({
            medicine_name: 'Metformin',
            dosage: '500mg',
            frequency: '1-0-1'
        });

        await component.saveMedication();
        expect(mockDataService.invoke).toHaveBeenCalledWith('saveMedication', expect.objectContaining({
            medicine_name: 'Metformin',
            patient_id: 123
        }));
        expect(component.showMedicationModal).toBe(false);

        await component.deleteMedication(30);
        expect(mockDataService.invoke).toHaveBeenCalledWith('deleteMedication', 30);
    });
});


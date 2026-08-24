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
        mockRouter = {
            navigate: vi.fn(),
            getCurrentNavigation: vi.fn().mockReturnValue({ extras: { state: {} } })
        };
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
            if (method === 'getActiveConsultation') return Promise.resolve(null);
            if (method === 'resumeConsultation') return Promise.resolve(null);
            if (method === 'saveVisit') return Promise.resolve(true);
            if (method === 'saveConsultationProgress') return Promise.resolve({ id: 7 });
            if (method === 'completeConsultation') return Promise.resolve({ id: 7, status: 'finished' });
            return Promise.resolve(null);
        });

        component = new VisitComponent(mockRoute, mockRouter, mockFb, mockNgZone, mockPdfService, mockDataService, mockAuthService);
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

    it('should set isConsulting to true when patient is in queue', async () => {
        const activeEncounter = { id: 7, patient_id: 1, status: 'in-progress', prescription: [] };
        // Override mock to return a queue item
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'getActiveConsultation') return Promise.resolve(activeEncounter);
            if (method === 'resumeConsultation') return Promise.resolve(activeEncounter);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getVitals') return Promise.resolve({});
            return Promise.resolve([]); // Default return array for lists, or null
        });

        component.ngOnInit();
        await component.loadData();

        expect(component.isConsulting).toBe(true);
        expect(component.visitForm.enable).toHaveBeenCalled();
        expect(mockDataService.invoke).toHaveBeenCalledWith('resumeConsultation', { encounterId: 7 });
    });

    it('keeps the form disabled until a postponed encounter reclaims its exact queue entry', async () => {
        component.patientId = 1;
        const activeEncounter = { id: 7, patient_id: 1, status: 'in-progress', prescription: [] };
        let releaseResume!: (value: any) => void;
        const resumePending = new Promise(resolve => { releaseResume = resolve; });
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'getVisits') return Promise.resolve([]);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getVitals') return Promise.resolve({});
            if (method === 'getActiveConsultation') return Promise.resolve(activeEncounter);
            if (method === 'resumeConsultation') return resumePending;
            return Promise.resolve(null);
        });

        const loading = component.loadData();
        await Promise.resolve();
        await Promise.resolve();
        expect(component.visitForm.disable).toHaveBeenCalled();
        expect(component.visitForm.enable).not.toHaveBeenCalled();

        releaseResume(activeEncounter);
        await loading;
        expect(component.visitForm.enable).toHaveBeenCalled();
        expect(component.encounterId).toBe(7);
    });

    it("keeps another practitioner's active patient chart private and read-only", async () => {
        component.patientId = 1;
        component.isConsulting = true;
        const history = [{ id: 5, patient_id: 1, status: 'finished', diagnosis: 'Prior visit' }];
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'getVisits') return Promise.resolve(history);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getVitals') return Promise.resolve({ pulse: 80 });
            if (method === 'getActiveConsultation') return Promise.reject(new Error('Only the responsible practitioner can access this encounter'));
            return Promise.resolve(null);
        });

        await component.loadData();

        expect(component.patient).toEqual({ id: 1, name: 'John' });
        expect(component.history).toEqual(history);
        expect(component.patientVitals).toEqual({ pulse: 80 });
        expect(component.isConsulting).toBe(false);
        expect(component.activeEncounterReadOnly).toBe(true);
        expect(component.encounterId).toBeNull();
        expect(component.editingVisitId).toBeNull();
        expect(component.visitForm.disable).toHaveBeenCalled();
        expect(component.visitForm.enable).not.toHaveBeenCalled();
        expect(mockDataService.invoke.mock.calls.some((call: any[]) => call[0] === 'beginConsultation')).toBe(false);
        expect(mockDataService.invoke.mock.calls.some((call: any[]) => call[0] === 'resumeConsultation')).toBe(false);

        component.editVisit(history[0]);
        expect(component.editingVisitId).toBeNull();
        expect(component.visitForm.enable).not.toHaveBeenCalled();
    });

    it('surfaces a retryable error instead of read-only mode for transient resume failures', async () => {
        component.patientId = 1;
        const activeEncounter = { id: 7, patient_id: 1, status: 'in-progress', prescription: [] };
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'getVisits') return Promise.resolve([]);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getVitals') return Promise.resolve({});
            if (method === 'getActiveConsultation') return Promise.resolve(activeEncounter);
            if (method === 'resumeConsultation') return Promise.reject(new Error('database is locked'));
            return Promise.resolve(null);
        });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await component.loadData();

        expect(component.activeEncounterReadOnly).toBe(false);
        expect(component.consultationLoadError).toContain('Retry');
        expect(component.encounterId).toBeNull();
        expect(component.visitForm.enable).not.toHaveBeenCalled();
    });

    it('leaves a failed start usable and reuses the request id on retry', async () => {
        component.patientId = 1;
        component.isConsulting = true;
        const requestIds: string[] = [];
        let attempts = 0;
        mockDataService.invoke.mockImplementation((method: string, input: any) => {
            if (method === 'getVisits') return Promise.resolve([]);
            if (method === 'getPatients') return Promise.resolve([{ id: 1, name: 'John' }]);
            if (method === 'getVitals') return Promise.resolve({});
            if (method === 'getActiveConsultation') return Promise.resolve(null);
            if (method === 'getQueue') return Promise.resolve([{ id: 9, patient_id: 1, status: 'waiting' }]);
            if (method === 'beginConsultation') {
                requestIds.push(input.startRequestId);
                attempts += 1;
                return attempts === 1 ? Promise.reject(new Error('response lost')) : Promise.resolve({ id: 7, prescription: [] });
            }
            return Promise.resolve(null);
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await component.loadData();
        expect(component.isConsulting).toBe(false);
        expect(component.consultationLoadError).toContain('Could not start');
        expect(component.visitForm.disable).toHaveBeenCalled();

        await component.retryConsultationLoad();
        expect(requestIds).toHaveLength(2);
        expect(requestIds[1]).toBe(requestIds[0]);
        expect(component.encounterId).toBe(7);
        expect(component.visitForm.enable).toHaveBeenCalled();
    });

    it('should save visit', async () => {
        component.patientId = 1;
        component.encounterId = 7;
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

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveConsultationProgress', {
            encounterId: 7,
            visit: expect.objectContaining({ symptoms: 'Cough', examination_notes: 'Throat Red' })
        });
    });

    it('keeps an in-progress draft out of history after saving progress', async () => {
        component.patientId = 1;
        component.encounterId = 7;
        component.visitForm = {
            value: { diagnosis: 'Draft' }, invalid: false, valid: true,
            reset: vi.fn(), patchValue: vi.fn(), disable: vi.fn(), enable: vi.fn(),
            markAllAsTouched: vi.fn(), get: vi.fn().mockReturnValue({ invalid: false })
        } as any;
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'saveConsultationProgress') return Promise.resolve({ id: 7 });
            if (method === 'getVisits') return Promise.resolve([
                { id: 7, status: 'in-progress', diagnosis: 'Draft' },
                { id: 6, status: 'finished', diagnosis: 'Prior' }
            ]);
            return Promise.resolve(null);
        });

        await component.saveVisit();
        await Promise.resolve();

        expect(component.history).toEqual([{ id: 6, status: 'finished', diagnosis: 'Prior' }]);
    });

    it('should not enter historical edit mode during an active consultation', () => {
        component.encounterId = 7;
        component.isConsulting = true;
        const activePatch = vi.spyOn(component.visitForm, 'patchValue');

        component.editVisit({ id: 42, diagnosis: 'Historical diagnosis' });

        expect(component.editingVisitId).toBeNull();
        expect(activePatch).not.toHaveBeenCalled();
        expect(component.encounterId).toBe(7);
    });

    it('should end consult', async () => {
        component.patientId = 1;
        component.encounterId = 7;
        // Ensure form is valid so endConsult proceeds
        component.visitForm = {
            value: {},
            invalid: false,
            valid: true,
            markAllAsTouched: vi.fn()
        } as any;


        await component.endConsult();

        expect(mockDataService.invoke).toHaveBeenCalledWith('completeConsultation', {
            encounterId: 7,
            visit: {}
        });
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/queue']);
    });

    it('should reuse the next-patient request id after a lost response', async () => {
        component.patientId = 1;
        component.encounterId = 7;
        component.isConsulting = true;
        component.visitForm = {
            value: { diagnosis: 'Done' }, invalid: false, valid: true,
            markAllAsTouched: vi.fn(), reset: vi.fn(), patchValue: vi.fn(),
            enable: vi.fn(), disable: vi.fn(), get: vi.fn().mockReturnValue({ value: '' })
        } as any;
        vi.spyOn(window, 'alert').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const requestIds: string[] = [];
        let nextAttempt = 0;
        mockDataService.invoke.mockImplementation((method: string, input: any) => {
            if (method === 'completeConsultation') return Promise.resolve({ id: 7, status: 'finished' });
            if (method === 'beginNextConsultation') {
                requestIds.push(input.startRequestId);
                nextAttempt += 1;
                return nextAttempt === 1
                    ? Promise.reject(new Error('response lost'))
                    : Promise.resolve({ id: 8, patient_id: 2 });
            }
            if (method === 'getVisits' || method === 'getPatients') return Promise.resolve([]);
            return Promise.resolve(null);
        });

        await component.finishAndNext();
        await component.finishAndNext();

        expect(requestIds).toHaveLength(2);
        expect(requestIds[1]).toBe(requestIds[0]);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/visit', 2], {
            state: { isConsulting: true, encounterId: 8 }
        });
    });

    it('should ignore a second Finish & Next click while completion is pending', async () => {
        component.encounterId = 7;
        component.visitForm = {
            value: { diagnosis: 'Done' }, invalid: false, valid: true,
            markAllAsTouched: vi.fn(), reset: vi.fn(), patchValue: vi.fn(),
            enable: vi.fn(), disable: vi.fn(), get: vi.fn().mockReturnValue({ value: '' })
        } as any;
        let releaseCompletion!: (value: any) => void;
        const pendingCompletion = new Promise(resolve => { releaseCompletion = resolve; });
        mockDataService.invoke.mockImplementation((method: string) => {
            if (method === 'completeConsultation') return pendingCompletion;
            if (method === 'beginNextConsultation') return Promise.resolve(null);
            return Promise.resolve(null);
        });
        vi.spyOn(window, 'alert').mockImplementation(() => undefined);

        const first = component.finishAndNext();
        const second = component.finishAndNext();
        releaseCompletion({ id: 7, status: 'finished' });
        await Promise.all([first, second]);

        expect(mockDataService.invoke.mock.calls.filter((call: any[]) => call[0] === 'completeConsultation')).toHaveLength(1);
        expect(mockDataService.invoke.mock.calls.filter((call: any[]) => call[0] === 'beginNextConsultation')).toHaveLength(1);
    });

    it('should ignore a second Finish & Exit click while completion is pending', async () => {
        component.encounterId = 7;
        component.visitForm = {
            value: { diagnosis: 'Done' }, invalid: false, valid: true,
            markAllAsTouched: vi.fn()
        } as any;
        let releaseCompletion!: (value: any) => void;
        mockDataService.invoke.mockImplementation((method: string) => method === 'completeConsultation'
            ? new Promise(resolve => { releaseCompletion = resolve; })
            : Promise.resolve(null));

        const first = component.endConsult();
        const second = component.endConsult();
        releaseCompletion({ id: 7, status: 'finished' });
        await Promise.all([first, second]);

        expect(mockDataService.invoke.mock.calls.filter((call: any[]) => call[0] === 'completeConsultation')).toHaveLength(1);
    });

    it('should ignore a second Postpone click and omit invalid visit data', async () => {
        component.encounterId = 7;
        component.visitForm = { value: {}, invalid: true, valid: false } as any;
        let releasePostpone!: (value: any) => void;
        mockDataService.invoke.mockImplementation((method: string) => method === 'postponeConsultation'
            ? new Promise(resolve => { releasePostpone = resolve; })
            : Promise.resolve(null));

        const first = component.postponeConsult();
        const second = component.postponeConsult();
        releasePostpone({ id: 7 });
        await Promise.all([first, second]);

        const calls = mockDataService.invoke.mock.calls.filter((call: any[]) => call[0] === 'postponeConsultation');
        expect(calls).toHaveLength(1);
        expect(calls[0][1]).toEqual({ encounterId: 7, visit: undefined });
    });
});

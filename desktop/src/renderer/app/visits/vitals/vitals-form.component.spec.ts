/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { VitalsFormComponent } from './vitals-form.component';

describe('VitalsFormComponent', () => {
    let component: VitalsFormComponent;
    let mockDataService: any;
    let mockNgZone: any;
    let fb: FormBuilder;

    beforeEach(() => {
        fb = new FormBuilder();
        mockDataService = {
            invoke: vi.fn().mockResolvedValue({ id: 99, status: 'final' })
        };
        mockNgZone = {
            run: vi.fn((fn: () => any) => fn())
        };
        component = new VitalsFormComponent(fb, mockDataService, mockNgZone);
    });

    it('should create with empty form marked as invalid due to allEmpty', () => {
        expect(component).toBeTruthy();
        expect(component.vitalsForm.valid).toBe(false);
        expect(component.vitalsForm.errors?.['allEmpty']).toBe(true);
    });

    it('validates blood pressure pairing and relationship', () => {
        // Systolic without diastolic
        component.vitalsForm.patchValue({ systolic_bp: 120, diastolic_bp: null });
        expect(component.vitalsForm.valid).toBe(false);
        expect(component.vitalsForm.errors?.['bpIncomplete']).toBe(true);

        // Diastolic without systolic
        component.vitalsForm.patchValue({ systolic_bp: null, diastolic_bp: 80 });
        expect(component.vitalsForm.valid).toBe(false);
        expect(component.vitalsForm.errors?.['bpIncomplete']).toBe(true);

        // Systolic less than diastolic
        component.vitalsForm.patchValue({ systolic_bp: 80, diastolic_bp: 120 });
        expect(component.vitalsForm.valid).toBe(false);
        expect(component.vitalsForm.errors?.['bpInvalidRelation']).toBe(true);

        // Systolic equal to diastolic
        component.vitalsForm.patchValue({ systolic_bp: 100, diastolic_bp: 100 });
        expect(component.vitalsForm.valid).toBe(false);
        expect(component.vitalsForm.errors?.['bpInvalidRelation']).toBe(true);

        // Valid pair
        component.vitalsForm.patchValue({ systolic_bp: 120, diastolic_bp: 80 });
        expect(component.vitalsForm.errors?.['bpIncomplete']).toBeFalsy();
        expect(component.vitalsForm.errors?.['bpInvalidRelation']).toBeFalsy();
        expect(component.vitalsForm.valid).toBe(true);
    });

    it('accepts partial valid submissions (pulse only)', () => {
        component.vitalsForm.patchValue({ pulse: 72 });
        expect(component.vitalsForm.valid).toBe(true);
    });

    it('calculates BMI when height and weight are provided', () => {
        component.vitalsForm.patchValue({ height: 180, weight: 72 });
        // 72 / (1.8 * 1.8) = 22.2
        expect(component.bmi).toBe('22.2');
    });

    it('submits valid vitals with durable identifiers and units', async () => {
        component.patientId = 12;
        component.queueEntryId = 34;
        component.visitId = 56;
        component.vitalsForm.patchValue({
            systolic_bp: 120,
            diastolic_bp: 80,
            pulse: 70
        });

        const emittedSpy = vi.spyOn(component.vitalsSaved, 'emit');

        await component.saveVitals();

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveVitals', expect.objectContaining({
            patient_id: 12,
            queue_entry_id: 34,
            visit_id: 56,
            systolic_bp: 120,
            diastolic_bp: 80,
            pulse: 70,
            units: expect.any(Object),
            client_request_id: expect.stringMatching(/^req-vitals-/)
        }));
        expect(emittedSpy).toHaveBeenCalled();
    });

    it('populates existing vitals in amendment mode and submits with replaces_id', async () => {
        component.patientId = 12;
        component.existingVitals = {
            id: 101,
            systolic_bp: 130,
            diastolic_bp: 85,
            pulse: 90
        };

        component.ngOnInit();
        expect(component.isAmending).toBe(true);
        expect(component.vitalsForm.get('pulse')?.value).toBe(90);

        // Edit pulse and add amendment reason
        component.vitalsForm.patchValue({
            pulse: 75,
            amendment_reason: 'Resting pulse re-check'
        });

        await component.saveVitals();

        expect(mockDataService.invoke).toHaveBeenCalledWith('saveVitals', expect.objectContaining({
            replaces_id: 101,
            amendment_reason: 'Resting pulse re-check',
            pulse: 75
        }));
    });
});

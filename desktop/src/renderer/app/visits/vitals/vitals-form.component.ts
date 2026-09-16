import { Component, NgZone, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DataService } from '../../services/api.service';
import { DEFAULT_VITAL_UNITS, VITALS_PHYSIOLOGICAL_RANGES } from '../../../../shared/vitals-validator';

function isPresent(val: unknown): boolean {
    return val !== null && val !== undefined && val !== '' && !Number.isNaN(val);
}

export const atLeastOneVitalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const fields = ['height', 'weight', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'respiratory_rate', 'spo2'];
    const hasAny = fields.some(f => isPresent(control.get(f)?.value));
    return hasAny ? null : { allEmpty: true };
};

export const bloodPressurePairValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const sysVal = control.get('systolic_bp')?.value;
    const diaVal = control.get('diastolic_bp')?.value;
    const hasSys = isPresent(sysVal);
    const hasDia = isPresent(diaVal);

    if (hasSys && !hasDia) {
        return { bpIncomplete: true };
    }
    if (!hasSys && hasDia) {
        return { bpIncomplete: true };
    }
    if (hasSys && hasDia) {
        const sys = Number(sysVal);
        const dia = Number(diaVal);
        if (sys <= dia) {
            return { bpInvalidRelation: true };
        }
    }
    return null;
};

@Component({
    selector: 'app-vitals-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 w-full max-w-xl shadow-2xl max-h-[95vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4 border-b pb-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">{{ isAmending ? 'Amend Vitals Observation' : 'Record Vitals' }}</h2>
                <p class="text-xs text-gray-500">
                    {{ isAmending ? 'Correcting previously recorded vital signs without erasing chart history.' : 'Enter physiological observations for this encounter.' }}
                </p>
            </div>
            <button type="button" (click)="cancel()" class="text-gray-400 hover:text-gray-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100">✕</button>
        </div>
        
        <!-- Validation Error Banner -->
        <div *ngIf="formSubmitted && vitalsForm.errors?.['allEmpty']" class="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
            <span>⚠️</span>
            <span>At least one vital sign measurement is required to save.</span>
        </div>

        <div *ngIf="vitalsForm.errors?.['bpIncomplete']" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <span>⚠️</span>
            <span>Both systolic and diastolic blood pressure must be provided together.</span>
        </div>

        <div *ngIf="vitalsForm.errors?.['bpInvalidRelation']" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <span>⚠️</span>
            <span>Systolic BP must be strictly greater than Diastolic BP.</span>
        </div>

        <form [formGroup]="vitalsForm" (ngSubmit)="saveVitals()">
            <div class="grid grid-cols-2 gap-4">
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                    <input type="number" formControlName="height" placeholder="e.g. 170" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('height')?.errors?.['min'] || vitalsForm.get('height')?.errors?.['max']" class="text-xs text-red-500 mt-1">20 - 300 cm</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input type="number" step="0.1" formControlName="weight" placeholder="e.g. 70" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('weight')?.errors?.['min'] || vitalsForm.get('weight')?.errors?.['max']" class="text-xs text-red-500 mt-1">0.5 - 500 kg</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">BMI (kg/m²)</label>
                    <input type="text" [value]="bmi" disabled class="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 font-mono">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Temperature (°F)</label>
                    <input type="number" step="0.1" formControlName="temperature" placeholder="e.g. 98.6" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('temperature')?.errors?.['min'] || vitalsForm.get('temperature')?.errors?.['max']" class="text-xs text-red-500 mt-1">50 - 115 °F</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
                    <input type="number" formControlName="systolic_bp" placeholder="e.g. 120" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('systolic_bp')?.errors?.['min'] || vitalsForm.get('systolic_bp')?.errors?.['max']" class="text-xs text-red-500 mt-1">50 - 300 mmHg</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Diastolic BP (mmHg)</label>
                    <input type="number" formControlName="diastolic_bp" placeholder="e.g. 80" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('diastolic_bp')?.errors?.['min'] || vitalsForm.get('diastolic_bp')?.errors?.['max']" class="text-xs text-red-500 mt-1">30 - 200 mmHg</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm)</label>
                    <input type="number" formControlName="pulse" placeholder="e.g. 72" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('pulse')?.errors?.['min'] || vitalsForm.get('pulse')?.errors?.['max']" class="text-xs text-red-500 mt-1">30 - 250 bpm</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                    <input type="number" formControlName="spo2" placeholder="e.g. 98" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('spo2')?.errors?.['min'] || vitalsForm.get('spo2')?.errors?.['max']" class="text-xs text-red-500 mt-1">50 - 100 %</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (bpm)</label>
                    <input type="number" formControlName="respiratory_rate" placeholder="e.g. 16" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                    <p *ngIf="vitalsForm.get('respiratory_rate')?.errors?.['min'] || vitalsForm.get('respiratory_rate')?.errors?.['max']" class="text-xs text-red-500 mt-1">8 - 60 bpm</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Effective Date & Time</label>
                    <input type="datetime-local" formControlName="effective_time" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs">
                </div>

                <!-- Amendment Reason when amending -->
                <div *ngIf="isAmending" class="col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Amendment Reason <span class="text-red-500">*</span></label>
                    <input type="text" formControlName="amendment_reason" placeholder="e.g. Re-measured resting BP after 15 mins" class="w-full border p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-6 border-t pt-4">
                <button type="button" (click)="cancel()" [disabled]="submitting" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" [disabled]="vitalsForm.invalid || submitting" class="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 flex items-center gap-2">
                    <span *ngIf="submitting" class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>{{ submitting ? 'Saving...' : (isAmending ? 'Save Amendment' : 'Save Vitals') }}</span>
                </button>
            </div>
        </form>
      </div>
    </div>
  `
})
export class VitalsFormComponent implements OnInit {
    vitalsForm: FormGroup;
    @Input() patientId: number | null = null;
    @Input() queueEntryId: number | null = null;
    @Input() visitId: number | null = null;
    @Input() existingVitals: any | null = null;

    @Output() closeDialog = new EventEmitter<void>();
    @Output() vitalsSaved = new EventEmitter<any>();

    submitting = false;
    formSubmitted = false;

    get isAmending(): boolean {
        return Boolean(this.existingVitals && (this.existingVitals.id || this.existingVitals.vital_id));
    }

    get bmi(): string {
        const h = this.vitalsForm.get('height')?.value;
        const w = this.vitalsForm.get('weight')?.value;
        if (h && w) {
            const hM = h / 100;
            const calculated = w / (hM * hM);
            return Number.isFinite(calculated) ? calculated.toFixed(1) : '';
        }
        return '';
    }

    constructor(private fb: FormBuilder, private dataService: DataService, private ngZone: NgZone) {
        const ranges = VITALS_PHYSIOLOGICAL_RANGES;
        this.vitalsForm = this.fb.group({
            height: [null, [Validators.min(ranges['height'].min), Validators.max(ranges['height'].max)]],
            weight: [null, [Validators.min(ranges['weight'].min), Validators.max(ranges['weight'].max)]],
            temperature: [null, [Validators.min(ranges['temperature_f'].min), Validators.max(ranges['temperature_f'].max)]],
            systolic_bp: [null, [Validators.min(ranges['systolic_bp'].min), Validators.max(ranges['systolic_bp'].max)]],
            diastolic_bp: [null, [Validators.min(ranges['diastolic_bp'].min), Validators.max(ranges['diastolic_bp'].max)]],
            pulse: [null, [Validators.min(ranges['pulse'].min), Validators.max(ranges['pulse'].max)]],
            respiratory_rate: [null, [Validators.min(ranges['respiratory_rate'].min), Validators.max(ranges['respiratory_rate'].max)]],
            spo2: [null, [Validators.min(ranges['spo2'].min), Validators.max(ranges['spo2'].max)]],
            effective_time: [this.getCurrentLocalIsoTime()],
            amendment_reason: ['']
        }, {
            validators: [atLeastOneVitalValidator, bloodPressurePairValidator]
        });
    }

    ngOnInit(): void {
        this.populateExistingVitalsIfPresent();
    }

    private getCurrentLocalIsoTime(): string {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    }

    private populateExistingVitalsIfPresent(): void {
        if (!this.existingVitals) return;
        const v = this.existingVitals;
        this.vitalsForm.patchValue({
            height: v.height ?? null,
            weight: v.weight ?? null,
            temperature: v.temperature ?? null,
            systolic_bp: v.systolic_bp ?? null,
            diastolic_bp: v.diastolic_bp ?? null,
            pulse: v.pulse ?? null,
            respiratory_rate: v.respiratory_rate ?? null,
            spo2: v.spo2 ?? null
        });
    }

    cancel(): void {
        this.closeDialog.emit();
    }

    async saveVitals(): Promise<void> {
        this.formSubmitted = true;
        if (this.vitalsForm.invalid || this.submitting) {
            this.vitalsForm.markAllAsTouched();
            return;
        }

        this.submitting = true;
        const formVal = this.vitalsForm.value;
        const originalId = this.existingVitals ? (this.existingVitals.id || this.existingVitals.vital_id) : null;
        const clientRequestId = `req-vitals-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const data: Record<string, unknown> = {
            patient_id: this.patientId,
            queue_entry_id: this.queueEntryId,
            visit_id: this.visitId,
            height: formVal.height != null && formVal.height !== '' ? Number(formVal.height) : null,
            weight: formVal.weight != null && formVal.weight !== '' ? Number(formVal.weight) : null,
            temperature: formVal.temperature != null && formVal.temperature !== '' ? Number(formVal.temperature) : null,
            systolic_bp: formVal.systolic_bp != null && formVal.systolic_bp !== '' ? Number(formVal.systolic_bp) : null,
            diastolic_bp: formVal.diastolic_bp != null && formVal.diastolic_bp !== '' ? Number(formVal.diastolic_bp) : null,
            pulse: formVal.pulse != null && formVal.pulse !== '' ? Number(formVal.pulse) : null,
            respiratory_rate: formVal.respiratory_rate != null && formVal.respiratory_rate !== '' ? Number(formVal.respiratory_rate) : null,
            spo2: formVal.spo2 != null && formVal.spo2 !== '' ? Number(formVal.spo2) : null,
            bmi: this.bmi ? parseFloat(this.bmi) : null,
            effective_time: formVal.effective_time ? new Date(formVal.effective_time).toISOString() : new Date().toISOString(),
            units: DEFAULT_VITAL_UNITS,
            client_request_id: clientRequestId
        };

        if (originalId) {
            data['replaces_id'] = originalId;
            data['amendment_reason'] = formVal.amendment_reason || 'Clinical amendment';
        }

        try {
            const savedResult = await this.dataService.invoke('saveVitals', data);
            this.ngZone.run(() => {
                this.submitting = false;
                this.vitalsSaved.emit(savedResult || data);
            });
        } catch (e) {
            this.ngZone.run(() => {
                this.submitting = false;
            });
            console.error('Failed to save vitals', e);
            alert(e instanceof Error ? e.message : 'Failed to save vitals');
        }
    }
}

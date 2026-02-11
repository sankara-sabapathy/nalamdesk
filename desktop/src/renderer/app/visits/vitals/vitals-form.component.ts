import { Component, Inject, NgZone, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService } from '../../services/api.service';

@Component({
    selector: 'app-vitals-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-[600px] shadow-xl">
        <h2 class="text-xl font-bold mb-4">Record Vitals</h2>
        
        <form [formGroup]="vitalsForm" (ngSubmit)="saveVitals()">
            <div class="grid grid-cols-2 gap-4">
                
                <div>
                    <label class="block text-sm font-medium text-gray-700">Height (cm)</label>
                    <input type="number" formControlName="height" class="w-full border p-2 rounded">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Weight (kg)</label>
                    <input type="number" formControlName="weight" class="w-full border p-2 rounded">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">BMI</label>
                    <input type="number" [value]="bmi" disabled class="w-full border p-2 rounded bg-gray-100">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Temperature (°F)</label>
                    <input type="number" formControlName="temperature" class="w-full border p-2 rounded">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Systolic BP (mmHg)</label>
                    <input type="number" formControlName="systolic_bp" class="w-full border p-2 rounded">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Diastolic BP (mmHg)</label>
                    <input type="number" formControlName="diastolic_bp" class="w-full border p-2 rounded">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Pulse (BPM)</label>
                    <input type="number" formControlName="pulse" class="w-full border p-2 rounded">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">SpO2 (%)</label>
                    <input type="number" formControlName="spo2" class="w-full border p-2 rounded">
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
                <button type="button" (click)="cancel()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" [disabled]="vitalsForm.invalid" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Save Vitals</button>
            </div>
        </form>
      </div>
    </div>
  `
})
export class VitalsFormComponent implements OnInit {
    vitalsForm: FormGroup;
    @Input() patientId: number | null = null;
    @Input() visitId: number | null = null;

    @Output() closeDialog = new EventEmitter<void>();
    @Output() save = new EventEmitter<any>();

    get bmi(): string {
        const h = this.vitalsForm.get('height')?.value;
        const w = this.vitalsForm.get('weight')?.value;
        if (h && w) {
            const hM = h / 100;
            return (w / (hM * hM)).toFixed(1);
        }
        return '';
    }

    constructor(private fb: FormBuilder, private dataService: DataService, private ngZone: NgZone) {
        this.vitalsForm = this.fb.group({
            height: [null, [Validators.min(0), Validators.max(300)]],
            weight: [null, [Validators.min(0), Validators.max(500)]],
            temperature: [null, [Validators.min(90), Validators.max(110)]],
            systolic_bp: [null, [Validators.min(50), Validators.max(250)]],
            diastolic_bp: [null, [Validators.min(30), Validators.max(150)]],
            pulse: [null, [Validators.min(30), Validators.max(200)]],
            respiratory_rate: [null, [Validators.min(10), Validators.max(60)]],
            spo2: [null, [Validators.min(50), Validators.max(100)]]
        });
    }

    ngOnInit() {
        // Logic to load existing vitals if editing
        this.vitalsForm.get('height')?.valueChanges.subscribe(() => this.updateBMI());
        this.vitalsForm.get('weight')?.valueChanges.subscribe(() => this.updateBMI());
    }

    updateBMI() {
        // Trigger change detection for getter if needed
    }

    cancel() {
        this.closeDialog.emit();
    }

    async saveVitals() {
        if (this.vitalsForm.invalid) {
            this.vitalsForm.markAllAsTouched();
            return;
        }

        const data = {
            patient_id: this.patientId,
            visit_id: this.visitId,
            ...this.vitalsForm.value,
            bmi: this.bmi ? parseFloat(this.bmi) : null
        };

        try {
            await this.dataService.invoke('saveVitals', data);
            this.ngZone.run(() => {
                this.save.emit(data);
            });
        } catch (e) {
            console.error('Failed to save vitals', e);
            alert('Failed to save vitals');
        }
    }
}

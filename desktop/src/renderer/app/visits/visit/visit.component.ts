import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { PdfService } from '../../services/pdf.service';
import { PrescriptionComponent } from '../../visits/prescription/prescription.component';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/api.service';


@Component({
  // ... (omitted)
  selector: 'app-visit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PrescriptionComponent],
  template: `
    <div class="flex h-screen bg-gray-100">
      <!-- Left Panel: History -->
      <div class="w-1/3 bg-white border-r border-gray-200 overflow-y-auto p-4">
        <button (click)="goBack()" class="mb-4 text-gray-500 hover:text-gray-800">← Back to Patients</button>
        <h2 class="text-xl font-bold mb-4">Patient History</h2>
        
        <div *ngIf="patient" class="mb-6 p-4 bg-blue-50 rounded">
          <h3 class="font-bold text-lg">{{ patient.name }}</h3>
          <p class="text-sm text-gray-600">{{ patient.age }} / {{ patient.gender }}</p>
          <p class="text-sm text-gray-600">{{ patient.mobile }}</p>
        </div>

        <div class="space-y-4">
          <div *ngFor="let visit of history" (click)="editVisit(visit)" class="border-l-4 border-blue-500 pl-4 py-2 cursor-pointer hover:bg-gray-50 transition" [class.bg-blue-50]="editingVisitId === visit.id">
            <p class="text-sm text-gray-500">{{ visit.date | date:'medium' }}</p>
            <div *ngIf="currentUser?.role !== 'receptionist'; else maskedContent">
                <p class="font-semibold">{{ visit.diagnosis }}</p>
                <div class="text-xs text-gray-600 mt-1">
                <span *ngFor="let med of visit.prescription" class="block">
                    • {{ med.medicine }} - {{ med.frequency }}
                </span>
                </div>
            </div>
            <ng-template #maskedContent>
                <p class="font-semibold text-gray-400 italic">Clinical notes hidden</p>
            </ng-template>
            <p class="text-xs text-right font-bold mt-1">₹{{ visit.amount_paid }}</p>
          </div>
          <p *ngIf="history.length === 0" class="text-gray-500 text-sm">No previous visits.</p>
        </div>
      </div>

      <div class="w-2/3 p-8 overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold">{{ editingVisitId ? 'Edit Visit' : 'New Visit' }}</h2>
            <div class="flex gap-4">
                <button *ngIf="editingVisitId" (click)="deleteVisit()" class="text-red-600 hover:underline text-sm">Delete Visit</button>
                <button *ngIf="editingVisitId" (click)="resetForm()" class="text-blue-600 hover:underline text-sm">Create New Visit</button>
            </div>
        </div>

        <!-- SOAP Tabs -->
        <div class="flex space-x-1 mb-4 border-b">
            <button class="px-4 py-2 font-medium" [class.border-b-2]="activeTab === 'S'" [class.border-blue-600]="activeTab === 'S'" [class.text-blue-600]="activeTab === 'S'" (click)="activeTab = 'S'">Subjective</button>
            <button class="px-4 py-2 font-medium" [class.border-b-2]="activeTab === 'O'" [class.border-blue-600]="activeTab === 'O'" [class.text-blue-600]="activeTab === 'O'" (click)="activeTab = 'O'">Objective</button>
            <button class="px-4 py-2 font-medium" [class.border-b-2]="activeTab === 'A'" [class.border-blue-600]="activeTab === 'A'" [class.text-blue-600]="activeTab === 'A'" (click)="activeTab = 'A'">Assessment</button>
            <button class="px-4 py-2 font-medium" [class.border-b-2]="activeTab === 'P'" [class.border-blue-600]="activeTab === 'P'" [class.text-blue-600]="activeTab === 'P'" (click)="activeTab = 'P'">Plan</button>
        </div>
        
        <form [formGroup]="visitForm" (ngSubmit)="saveVisit()">
          
          <!-- Subjective -->
          <div *ngIf="activeTab === 'S'" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Chief Complaint / Symptoms</label>
            <textarea formControlName="symptoms" rows="6" class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" placeholder="Patient's complaints..."></textarea>
          </div>

          <!-- Objective -->
          <div *ngIf="activeTab === 'O'" class="mb-6">
             <div *ngIf="patientVitals" class="bg-blue-50 p-4 rounded mb-4">
                <h3 class="font-bold text-blue-800 mb-2">Use Latest Vitals</h3>
                <div class="grid grid-cols-4 gap-4 text-sm">
                    <div><span class="text-gray-600">BP:</span> <span class="font-bold">{{ patientVitals.systolic_bp || '-' }}/{{ patientVitals.diastolic_bp || '-' }}</span></div>
                    <div><span class="text-gray-600">Pulse:</span> <span class="font-bold">{{ patientVitals.pulse || '-' }}</span></div>
                    <div><span class="text-gray-600">Temp:</span> <span class="font-bold">{{ patientVitals.temperature || '-' }}°F</span></div>
                    <div><span class="text-gray-600">BMI:</span> <span class="font-bold">{{ patientVitals.bmi || '-' }}</span></div>
                </div>
             </div>
             <div *ngIf="!patientVitals" class="text-sm text-gray-500 italic mb-4">No recent vitals recorded.</div>

            <label class="block text-sm font-medium text-gray-700 mb-2">Physical Examination Notes</label>
            <textarea formControlName="examination_notes" rows="6" class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" placeholder="Clinical findings..."></textarea>
          </div>

          <!-- Assessment -->
          <div *ngIf="activeTab === 'A'" class="mb-6">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Diagnosis <span class="text-red-500">*</span></label>
                <textarea formControlName="diagnosis" rows="3" class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" 
                    [class.border-red-500]="visitForm.get('diagnosis')?.invalid && (visitForm.get('diagnosis')?.dirty || visitForm.get('diagnosis')?.touched)"></textarea>
                <span *ngIf="visitForm.get('diagnosis')?.invalid && (visitForm.get('diagnosis')?.dirty || visitForm.get('diagnosis')?.touched)" class="text-xs text-red-500">Diagnosis is required</span>
            </div>
             <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Diagnosis Type</label>
                <select formControlName="diagnosis_type" class="w-full border p-2 rounded">
                    <option value="">Select Type</option>
                    <option value="Provisional">Provisional</option>
                    <option value="Final">Final</option>
                </select>
            </div>
          </div>

          <!-- Plan -->
          <div *ngIf="activeTab === 'P'" class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm font-medium text-gray-700">Prescription</label>
            </div>
            
            <app-prescription 
                [initialData]="currentPrescription" 
                (changed)="updatePrescription($event)">
            </app-prescription>
          </div>

          <div class="mb-6 w-48 border-t pt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount Paid (₹)</label>
            <input type="number" formControlName="amount_paid" class="w-full border p-2 rounded">
          </div>

          <div class="flex gap-4">
            <ng-container *ngIf="isConsulting || editingVisitId; else noConsult">
              <button type="submit" [disabled]="!visitForm.valid" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition">
                {{ editingVisitId ? 'Update Visit' : 'Save Progress' }}
              </button>
              
              <button *ngIf="isConsulting" type="button" (click)="endConsult()" [disabled]="!visitForm.valid" class="bg-blue-800 text-white px-6 py-2 rounded hover:bg-blue-900 transition flex items-center gap-2">
                <span>✓</span> End Consult
              </button>

              <button *ngIf="isConsulting" type="button" (click)="postponeConsult()" class="bg-yellow-100 text-yellow-800 border border-yellow-300 px-6 py-2 rounded hover:bg-yellow-200 transition">
                Postpone
              </button>
            </ng-container>

            <ng-template #noConsult>
              <div class="alert alert-warning">
                <span>Start a consultation from the Queue to add a new visit.</span>
              </div>
            </ng-template>

            <button type="button" (click)="printPrescription()" class="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition">
              Print Prescription
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class VisitComponent implements OnInit {
  patientId!: number;
  patient: any;
  history: any[] = [];
  visitForm: FormGroup;
  editingVisitId: number | null = null;
  isConsulting = false;

  currentPrescription: any[] = [];

  private dataService: DataService = inject(DataService);
  private authService: AuthService = inject(AuthService);
  currentUser: any = null;

  activeTab: 'S' | 'O' | 'A' | 'P' = 'S';
  patientVitals: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private ngZone: NgZone,
    private pdfService: PdfService
  ) {
    this.visitForm = this.fb.group({
      symptoms: [''],
      examination_notes: [''],
      diagnosis: [''],
      diagnosis_type: [''],
      prescription: [[]],
      amount_paid: [0]
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.route.params.subscribe(params => {
      this.patientId = +params['id'];
      this.loadData();
    });
  }

  editVisit(visit: any) {
    this.editingVisitId = visit.id;
    this.visitForm.patchValue({
      symptoms: visit.symptoms,
      examination_notes: visit.examination_notes,
      diagnosis: visit.diagnosis,
      diagnosis_type: visit.diagnosis_type,
      amount_paid: visit.amount_paid
    });

    if (visit.prescription && visit.prescription.length > 0) {
      this.currentPrescription = visit.prescription;
      this.visitForm.patchValue({ prescription: visit.prescription });
    } else {
      this.currentPrescription = [];
      this.visitForm.patchValue({ prescription: [] });
    }
  }

  resetForm() {
    this.editingVisitId = null;
    this.visitForm.reset({ amount_paid: 0, prescription: [] });
    this.currentPrescription = [];
  }

  async loadData() {
    try {
      const visits = await this.dataService.invoke<any>('getVisits', this.patientId);
      const allPatients = await this.dataService.invoke<any>('getPatients', '');
      const p = allPatients.find((p: any) => p.id === this.patientId);

      const vitals = await this.dataService.invoke<any>('getVitals', this.patientId);

      this.ngZone.run(() => {
        this.patient = p;
        this.history = visits;
        this.patientVitals = vitals;
      });

      // Check Queue Status
      const queue = await this.dataService.invoke<any>('getQueue');
      console.log('DEBUG: VisitComponent patientId:', this.patientId, typeof this.patientId);
      console.log('DEBUG: Queue Content:', JSON.stringify(queue));

      const queueItem = queue.find((q: any) => q.patient_id == this.patientId && q.status === 'in-consult');
      console.log('DEBUG: Found QueueItem:', queueItem);

      this.ngZone.run(() => {
        this.isConsulting = !!queueItem;
        console.log('DEBUG: isConsulting:', this.isConsulting);
        // If not consulting and not editing, disable form
        if (!this.isConsulting && !this.editingVisitId) {
          this.visitForm.disable(); // THIS IS WHAT CAUSES THE BUG MESSAGE
        } else {
          this.visitForm.enable();
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  updatePrescription(items: any[]) {
    this.visitForm.patchValue({ prescription: items });
  }

  async saveVisit(): Promise<boolean> {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return false;
    }

    // Get active doctor from current user session
    const currentUser = this.authService.getUser();

    // Logic: If I am a doctor/admin, I am the doctor.
    // If we want to allow selecting a doctor, we would need a dropdown.
    // For now, assume the logged-in user is the doctor.
    const doctorId = currentUser?.id;

    const visitData = {
      id: this.editingVisitId, // If editing
      patient_id: this.patientId,
      doctor_id: doctorId ? +doctorId : null,
      ...this.visitForm.value
    };

    try {
      await this.dataService.invoke('saveVisit', visitData);
      this.ngZone.run(() => {
        this.resetForm();
        this.loadData();
      });
      return true;
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  }

  async deleteVisit() {
    if (!this.editingVisitId) return;
    if (confirm('Are you sure you want to delete this visit?')) {
      try {
        await this.dataService.invoke('deleteVisit', this.editingVisitId);
        this.ngZone.run(() => {
          this.resetForm();
          this.loadData();
        });
      } catch (e) {
        console.error(e);
        alert('Failed to delete visit');
      }
    }
  }

  async printPrescription() {
    // Get current doctor
    try {
      const settings = await this.dataService.invoke<any>('getPublicSettings');
      const currentUser = this.authService.getUser();

      const doctor = {
        name: currentUser?.name || settings?.doctor_name || 'Doctor',
        specialty: currentUser?.specialty || 'General',
        license_number: currentUser?.license_number || settings?.license_key || ''
      };

      await this.pdfService.generatePrescription(
        { ...this.visitForm.value, date: new Date() },
        this.patient,
        doctor
      );
    } catch (e) {
      console.error('Print failed', e);
    }
  }

  async endConsult() {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      alert('Please fill in the diagnosis/symptoms to complete the consultation.');
      return;
    }

    const saved = await this.saveVisit();
    if (!saved) return;

    try {
      await this.dataService.invoke('updateQueueStatusByPatientId', { patientId: this.patientId, status: 'completed' });
      this.ngZone.run(() => {
        this.router.navigate(['/queue']);
      });
    } catch (e) {
      console.error('Failed to end consult', e);
      alert('Failed to update queue status. Please try again.');
    }
  }

  async postponeConsult() {
    if (this.visitForm.dirty && this.visitForm.valid) {
      await this.saveVisit();
    }

    try {
      await this.dataService.invoke('updateQueueStatusByPatientId', { patientId: this.patientId, status: 'waiting' });
      this.router.navigate(['/queue']);
    } catch (e) {
      console.error('Failed to postpone', e);
    }
  }

  goBack() {
    this.router.navigate(['/patients']);
  }
}

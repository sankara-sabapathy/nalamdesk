import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { PdfService } from '../../services/pdf.service';
import { PrescriptionComponent } from '../../visits/prescription/prescription.component';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/api.service';

interface PrescriptionItem {
  medicine: string;
  frequency: string;
  duration?: string;
  instructions?: string;
}

interface Visit {
  id: number;
  date: string;
  diagnosis: string;
  diagnosis_type?: string;
  symptoms?: string;
  examination_notes?: string;
  prescription: PrescriptionItem[];
  amount_paid: number;
  patient_id?: number;
  doctor_id?: number;
}

@Component({
  selector: 'app-visit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PrescriptionComponent],
  template: `
    <div class="flex h-full bg-gray-50 font-sans overflow-hidden relative">
      
      <!-- Mobile Backdrop -->
      <div *ngIf="showMobileHistory" (click)="showMobileHistory = false" class="fixed inset-0 bg-black/50 z-40 md:hidden glass"></div>

      <!-- Left Panel: History & Context (Responsive Drawer) -->
      <div class="fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-2xl transition-transform duration-300 md:relative md:translate-x-0 md:shadow-none"
           [class.translate-x-0]="showMobileHistory"
           [class.-translate-x-full]="!showMobileHistory">
        
        <!-- Back & Header -->
        <div class="p-4 border-b bg-gray-50 flex justify-between items-start">
          <div>
            <button (click)="goBack()" class="text-xs text-gray-500 hover:text-blue-600 mb-2 flex items-center gap-1 font-medium">
                <span class="text-lg">‹</span> Back to Queue
            </button>
            <div *ngIf="patient">
                <h2 class="font-bold text-lg text-gray-800 leading-tight">{{ patient.name }}</h2>
                <p class="text-xs text-gray-500 font-medium mt-1">{{ patient.age }} / {{ patient.gender }} • {{ patient.mobile }}</p>
            </div>
          </div>
          <!-- Close Drawer Button (Mobile Only) -->
           <button (click)="showMobileHistory = false" class="md:hidden text-gray-500 p-1">
             ✕
           </button>
        </div>

        <!-- Scrollable History List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-100/50">
           
           <!-- Last Visit PINNED CARD -->
           <div *ngIf="history.length > 0; else noHistory" class="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm relative group">
              <div class="flex justify-between items-start mb-2">
                 <span class="text-xs font-bold text-blue-800 uppercase tracking-wider">Last Visit</span>
                 <span class="text-xs text-blue-600">{{ history[0].date | date:'mediumDate' }}</span>
              </div>
              
              <div class="text-sm text-gray-800 font-medium mb-1 line-clamp-2" title="{{ history[0].diagnosis }}">
                {{ history[0].diagnosis || 'No Diagnosis' }}
              </div>
              
              <div class="text-xs text-gray-600 space-y-1 mb-3">
                 <div *ngFor="let med of history[0].prescription | slice:0:3">
                    • {{ med.medicine }}
                 </div>
                 <div *ngIf="(history[0].prescription?.length || 0) > 3" class="text-gray-400 italic">+ more</div>
              </div>

              <!-- COPY ACTION -->
              <button (click)="copyLastVisit()" class="w-full py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 hover:text-blue-900 transition flex items-center justify-center gap-2 shadow-sm">
                <span>📋</span> Copy to Current
              </button>
           </div>
           <ng-template #noHistory>
              <div class="text-center py-8 text-gray-400 text-sm italic">No previous visits.</div>
           </ng-template>

           <!-- Divider -->
           <div *ngIf="history.length > 1" class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2 px-1">Older History</div>

           <!-- Older items -->
           <div *ngFor="let visit of history | slice:1" (click)="editVisit(visit)" 
                class="bg-white border hover:border-blue-400 rounded p-3 cursor-pointer transition shadow-sm"
                [class.ring-2]="editingVisitId === visit.id" [class.ring-blue-500]="editingVisitId === visit.id">
              <p class="text-xs text-gray-500 mb-1">{{ visit.date | date:'mediumDate' }}</p>
              <p class="text-sm font-medium text-gray-800 truncate">{{ visit.diagnosis }}</p>
           </div>
        </div>
      </div>

      <!-- Main Panel: The "Chart" (Vertical Document) -->
      <div class="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        
        <!-- Header / Toolbar -->
        <div class="min-h-16 py-2 border-b flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 bg-white z-20 sticky top-0 gap-2">
           <div class="flex items-center gap-3">
               <!-- Mobile Toggle -->
               <button (click)="showMobileHistory = !showMobileHistory" class="md:hidden btn btn-circle btn-sm btn-ghost">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                   </svg>
               </button>

               <h1 class="text-lg md:text-xl font-bold text-gray-800 truncate">
                 {{ editingVisitId ? 'Editing Past Visit' : 'Current Consultation' }}
               </h1>
           </div>

           <div class="flex flex-wrap gap-2 items-center justify-end">
              <button *ngIf="editingVisitId" (click)="deleteVisit()" class="border border-red-200 text-red-600 bg-white hover:bg-red-50 px-3 py-1 rounded text-sm font-medium transition">Delete</button>
              <button *ngIf="editingVisitId" (click)="resetForm()" class="border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 px-3 py-1 rounded text-sm font-medium transition">New Visit</button>
              <div class="text-right flex items-center gap-2" *ngIf="!editingVisitId">
                  <div class="hidden md:block text-xs text-gray-500 uppercase tracking-wider font-bold">Status</div>
                  <div class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold gap-1 flex items-center">
                    <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> LIVE
                  </div>
              </div>
           </div>
        </div>

        <!-- SCROLLABLE DOCUMENT BODY -->
        <div class="flex-1 overflow-y-auto bg-gray-50/50">
           <div class="w-full px-4 md:px-8 py-8">
              <form [formGroup]="visitForm" class="space-y-6">
                 
                 <!-- SECTION 1: SUBJECTIVE -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">S</div>
                        <h3 class="text-lg font-bold">Subjective</h3>
                    </div>
                    <textarea formControlName="symptoms" rows="3" placeholder="Chief complaints, history of present illness..." 
                        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700 placeholder-gray-400"></textarea>
                 </div>

                 <!-- SECTION 2: OBJECTIVE -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                        <div class="flex items-center gap-3 text-gray-800">
                            <div class="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-sm">O</div>
                            <h3 class="text-lg font-bold">Objective</h3>
                        </div>
                        <!-- Vitals Pill -->
                        <div *ngIf="patientVitals" class="bg-teal-50 text-teal-800 text-xs px-3 py-1.5 rounded-full font-medium border border-teal-100 flex flex-wrap gap-3">
                            <span>BP: <b>{{ patientVitals.systolic_bp }}/{{ patientVitals.diastolic_bp }}</b></span>
                            <span>Pulse: <b>{{ patientVitals.pulse }}</b></span>
                            <span>Temp: <b>{{ patientVitals.temperature }}</b></span>
                        </div>
                    </div>
                    <textarea formControlName="examination_notes" rows="3" placeholder="Physical exam findings, labs, observations..." 
                        class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition text-gray-700 placeholder-gray-400"></textarea>
                 </div>

                 <!-- SECTION 3: ASSESSMENT -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">A</div>
                        <h3 class="text-lg font-bold">Assessment</h3>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="md:col-span-3">
                             <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Diagnosis <span class="text-red-500">*</span></label>
                             <input formControlName="diagnosis" type="text" placeholder="Primary Diagnosis" 
                                class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none font-medium text-lg"
                                [class.border-red-500]="visitForm.get('diagnosis')?.invalid && (visitForm.get('diagnosis')?.dirty || visitForm.get('diagnosis')?.touched)">
                             <p *ngIf="visitForm.get('diagnosis')?.invalid && (visitForm.get('diagnosis')?.dirty)" class="text-xs text-red-500 mt-1">Diagnosis is required</p>
                        </div>
                        <div class="md:col-span-1">
                             <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                             <select formControlName="diagnosis_type" class="w-full p-2.5 border border-gray-300 rounded bg-white">
                                <option value="">Select</option>
                                <option value="Provisional">Provisional</option>
                                <option value="Final">Final</option>
                             </select>
                        </div>
                    </div>
                 </div>

                 <!-- SECTION 4: PLAN (Rx) -->
                 <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div class="flex items-center gap-3 mb-4 text-gray-800">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">P</div>
                        <h3 class="text-lg font-bold">Plan & Rx</h3>
                    </div>
                    
                    <app-prescription 
                        [initialData]="currentPrescription" 
                        (changed)="updatePrescription($event)">
                    </app-prescription>

                    <div class="mt-6 pt-4 border-t w-full md:w-1/3">
                         <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Total Fee (₹)</label>
                         <input type="number" formControlName="amount_paid" class="w-full p-2 border border-gray-300 rounded font-mono font-bold text-gray-700">
                    </div>
                 </div>
                 
                 <!-- Spacer for footer -->
                 <div class="h-24"></div>
              </form>
           </div>
        </div>

        <!-- STICKY FOOTER ACTION BAR -->
        <div class="min-h-20 bg-white border-t px-4 md:px-8 flex flex-col md:flex-row items-center justify-between z-30 py-3 gap-3">
            <div class="flex gap-3 w-full md:w-auto justify-center md:justify-start">
               <button type="button" (click)="printPrescription()" class="px-4 py-2 rounded text-gray-600 hover:bg-gray-100 font-medium transition flex-1 md:flex-none justify-center">
                 Print
               </button>
               <button *ngIf="isConsulting" type="button" (click)="postponeConsult()" class="px-4 py-2 rounded text-blue-600 border border-transparent hover:border-blue-200 hover:bg-blue-50 font-medium transition flex-1 md:flex-none justify-center">
                 ⏸ Postpone
               </button>
            </div>

            <div class="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
               <ng-container *ngIf="isConsulting || editingVisitId; else noConsult">
                  <!-- Classic Save -->
                   <button type="submit" (click)="saveVisit()" [disabled]="!visitForm.valid" class="hidden md:block px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition disabled:opacity-50 font-medium">
                     Save Progress
                   </button>
                   
                   <!-- Finish & Exit -->
                   <button *ngIf="isConsulting" type="button" (click)="endConsult()" [disabled]="!visitForm.valid" class="hidden md:block px-4 py-2 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 transition disabled:opacity-50 font-medium">
                     Finish & Exit
                   </button>

                   <!-- HERO ACTION: FINISH & NEXT -->
                   <button *ngIf="isConsulting" type="button" (click)="finishAndNext()" [disabled]="!visitForm.valid" class="w-full md:w-auto px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
                     <span>✓ Finish & Next</span> 
                   </button>
                   
                   <button *ngIf="editingVisitId" (click)="saveVisit()" [disabled]="!visitForm.valid" class="w-full md:w-auto px-6 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-sm">
                      Update Record
                   </button>
               </ng-container>

               <ng-template #noConsult>
                   <div class="text-sm text-gray-400 italic">Read-only mode</div>
               </ng-template>
            </div>
        </div>

      </div>
    </div>
  `,
  styles: []
})
export class VisitComponent implements OnInit {
  patientId!: number;
  patient: any;
  history: Visit[] = [];
  visitForm: FormGroup;
  editingVisitId: number | null = null;
  isConsulting = false;
  currentUser: any;
  patientVitals: any;
  showMobileHistory = false;

  currentPrescription: any[] = [];
  // ...

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private ngZone: NgZone,
    private pdfService: PdfService,
    private dataService: DataService,
    private authService: AuthService
  ) {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state?.['isConsulting']) {
      this.isConsulting = true;
    }

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
    this.visitForm.enable();

    // On mobile, close drawer after selection
    this.showMobileHistory = false;
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

        // Auto-Enable if state passed
        if (this.isConsulting) {
          this.visitForm.enable();

          // Auto-Fill Vitals into Objective if empty
          if (this.patientVitals && !this.visitForm.get('examination_notes')?.value) {
            const v = this.patientVitals;
            const text = `BP: ${v.systolic_bp}/${v.diastolic_bp}\nPulse: ${v.pulse}\nTemp: ${v.temperature}`;
          }
        }
      });

      // Double Check Queue Status (Fallback for direct URL access)
      if (!this.isConsulting) {
        const queue = await this.dataService.invoke<any>('getQueue');
        const queueItem = queue.find((q: any) => q.patient_id == this.patientId && q.status === 'in-consult');

        this.ngZone.run(() => {
          if (queueItem) {
            this.isConsulting = true;
            this.visitForm.enable();
          } else if (!this.editingVisitId) {
            // FORCE ENABLE FOR DEBUGGING
            this.visitForm.enable();
            // this.visitForm.disable(); // DISABLED FOR DEBUGGING
            console.warn('DEBUG: Unresponsive Fix - Would have disabled form, but forced enabled.');
          }
        });
      }
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

    const currentUser = this.authService.getUser();
    const doctorId = currentUser?.id;

    const visitData = {
      id: this.editingVisitId,
      patient_id: this.patientId,
      doctor_id: doctorId ? +doctorId : null,
      ...this.visitForm.value
    };

    try {
      await this.dataService.invoke('saveVisit', visitData);
      this.ngZone.run(() => {
        if (this.editingVisitId) {
          this.resetForm();
          // Only reset if regular edit, keeping consult open? 
          // Actually for classic flow, saving progress shouldn't clear form until Done.
        }
        // Reload history
        this.dataService.invoke<any>('getVisits', this.patientId).then(v => this.history = v);
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

  // --- New Logic: Finish & Next ---

  async endConsult() {
    // Just end, go to queue (Old behavior)
    if (await this.completeConsult()) {
      this.router.navigate(['/queue']);
    }
  }

  async finishAndNext() {
    // 1. Complete current
    if (await this.completeConsult()) {
      // 2. Find next patient
      const nextPatient = await this.findNextInQueue();
      if (nextPatient) {
        // 3. Navigate to next
        this.ngZone.run(() => {
          this.patientId = nextPatient.patient_id;
          this.editingVisitId = null;
          this.visitForm.reset({ amount_paid: 0, prescription: [] });
          this.currentPrescription = [];
          this.isConsulting = true;
          this.router.navigate(['/visit', nextPatient.patient_id], {
            state: { isConsulting: true }
          });
          // Force reload since we are on same route component
          this.loadData();
        });
        // Note: Angular doesn't always reload same route. 
        // We might need to handle RouteReuseStrategy or just manually reset.
      } else {
        alert('Queue is empty! Great job.');
        this.router.navigate(['/queue']);
      }
    }
  }

  async completeConsult(): Promise<boolean> {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      alert('Please complete diagnosis.');
      return false;
    }

    const saved = await this.saveVisit();
    if (!saved) return false;

    try {
      await this.dataService.invoke('updateQueueStatusByPatientId', { patientId: this.patientId, status: 'completed' });
      return true;
    } catch (e) {
      console.error('Failed to end consult', e);
      alert('Failed to update queue status.');
      return false;
    }
  }

  async findNextInQueue(): Promise<any> {
    try {
      const queue = await this.dataService.invoke<any[]>('getQueue');
      // Filter for waiting
      const waiting = queue.filter(q => q.status === 'waiting');
      // Sort: Priority 2 (Emergency) > Priority 1 
      // Then by check_in_time (asc)
      waiting.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority; // 2 - 1
        return new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
      });

      if (waiting.length > 0) {
        // Mark as in-consult
        const next = waiting[0];
        await this.dataService.invoke('updateQueueStatus', { id: next.id, status: 'in-consult' });
        return next;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  copyLastVisit() {
    if (this.history.length > 0) {
      const last = this.history[0];
      this.visitForm.patchValue({
        diagnosis: last.diagnosis,
        diagnosis_type: last.diagnosis_type,
        prescription: last.prescription
      });
      this.currentPrescription = last.prescription || [];
      // Optional: Notify user
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
      console.error(e);
    }
  }

  goBack() {
    this.router.navigate(['/patients']);
  }
}

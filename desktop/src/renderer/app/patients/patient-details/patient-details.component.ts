import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../shared/services/dialog.service';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';

@Component({
    selector: 'app-patient-details',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerComponent],
    styles: [`
        @media print {
            /* Hide everything by default */
            div.min-h-screen > div:first-child, /* Header */
            div.min-h-screen > div:nth-child(2) { /* Main Content */
                display: none !important;
            }

            /* Show ONLY the modal content */
            .fixed.inset-0 {
                position: static !important;
                background: white !important;
                display: block !important;
            }
            .fixed.inset-0 > div {
                box-shadow: none !important;
                max-width: 100% !important;
                max-height: none !important;
                border-radius: 0 !important;
            }
            
            /* Hide modal close button & actions */
            .fixed.inset-0 button, 
            .fixed.inset-0 .border-t { 
                display: none !important; 
            }

            /* Ensure body is visible and formatted */
            .p-8 { padding: 0 !important; }
            .overflow-y-auto { overflow: visible !important; }
            
            /* Typography for Print */
            body { font-family: serif; font-size: 12pt; color: black; }
            h1 { font-size: 18pt; margin-bottom: 0.5rem; }
            p { margin-bottom: 0.25rem; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border-bottom: 1px solid #ddd; padding: 4px; text-align: left; }
            th { font-weight: bold; }
        }
    `],
    template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <!-- Header / Breadcrumbs -->
      <div class="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span class="hover:text-blue-600 cursor-pointer" (click)="goBack()">Patients</span>
          <span>/</span>
          <span class="font-medium text-gray-800">{{ patient?.name || 'Loading...' }}</span>
        </div>
        <div class="flex gap-3">
             <button *ngIf="currentUser?.role === 'admin'" (click)="deletePatient()" class="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm font-medium transition border border-transparent hover:border-red-100">Delete Patient</button>
             <button *ngIf="currentUser?.role === 'admin' || currentUser?.role === 'doctor'" (click)="startConsult()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 transition">
                Start Consultation
             </button>
        </div>
      </div>

      <div class="flex-1 max-w-7xl mx-auto w-full p-8 grid grid-cols-12 gap-8">
        
        <!-- LEFT COL: Profile & Vitals -->
        <div class="col-span-12 md:col-span-4 space-y-6">
            <!-- Profile Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-teal-400"></div>
                <div class="flex justify-between items-start mb-4">
                    <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                        {{ patient?.name?.charAt(0) || '?' }}
                    </div>
                    <button class="text-gray-400 hover:text-blue-600 font-bold text-sm" (click)="openEditModal()">EDIT</button>
                </div>
                <h1 class="text-2xl font-bold text-gray-800 mb-1">{{ patient?.name }}</h1>
                <p class="text-sm text-gray-500 font-medium mb-4">{{ patient?.age }} Years / {{ patient?.gender }}</p>
                
                <div class="space-y-3 pt-4 border-t border-gray-100">
                    <div class="flex items-center gap-3 text-sm text-gray-600">
                        <span class="text-gray-400">📱</span> {{ patient?.mobile }}
                    </div>
                    <div class="flex items-center gap-3 text-sm text-gray-600">
                        <span class="text-gray-400">📍</span> {{ patient?.address || 'No address' }}
                    </div>
                    <div class="flex items-center gap-3 text-sm text-gray-600">
                         <span class="text-gray-400">🩸</span> {{ patient?.blood_group || '-' }}
                    </div>
                </div>
            </div>

            <!-- Vitals Snapshot -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span class="text-teal-500">♥</span> Last Vitals
                </h3>
                <div *ngIf="vitals; else noVitals" class="grid grid-cols-2 gap-4">
                    <div class="p-3 bg-gray-50 rounded border border-gray-100">
                        <div class="text-xs text-gray-500 uppercase font-bold">BP</div>
                        <div class="text-lg font-mono font-bold text-gray-800">{{ vitals.systolic_bp }}/{{ vitals.diastolic_bp }}</div>
                    </div>
                     <div class="p-3 bg-gray-50 rounded border border-gray-100">
                        <div class="text-xs text-gray-500 uppercase font-bold">Pulse</div>
                        <div class="text-lg font-mono font-bold text-gray-800">{{ vitals.pulse }} <span class="text-xs font-normal">bpm</span></div>
                    </div>
                     <div class="p-3 bg-gray-50 rounded border border-gray-100">
                        <div class="text-xs text-gray-500 uppercase font-bold">Temp</div>
                        <div class="text-lg font-mono font-bold text-gray-800">{{ vitals.temperature }} <span class="text-xs font-normal">°F</span></div>
                    </div>
                     <div class="p-3 bg-gray-50 rounded border border-gray-100">
                        <div class="text-xs text-gray-500 uppercase font-bold">Weight</div>
                        <div class="text-lg font-mono font-bold text-gray-800">{{ vitals.weight }} <span class="text-xs font-normal">kg</span></div>
                    </div>
                </div>
                <ng-template #noVitals>
                    <div class="text-sm text-gray-400 italic text-center py-4">No vitals recorded.</div>
                </ng-template>
            </div>
        </div>

        <!-- RIGHT COL: Visit History -->
        <div class="col-span-12 md:col-span-8">
             <div class="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                <div class="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                    <h3 class="font-bold text-gray-800 text-lg">Visit History</h3>
                    <button (click)="loadData()" class="text-xs text-blue-600 hover:underline">Refresh</button>
                </div>

                <div class="flex-1 overflow-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-bold sticky top-0">
                            <tr>
                                <th class="px-6 py-3">Date</th>
                                <th class="px-6 py-3">Diagnosis</th>
                                <th class="px-6 py-3">Rx Items</th>
                                <th class="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr *ngFor="let visit of visits" class="hover:bg-blue-50/50 transition group">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                    {{ visit.date | date:'mediumDate' }}
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-800 font-medium">
                                    {{ visit.diagnosis || 'No Diagnosis' }}
                                    <span *ngIf="visit.diagnosis_type" class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                                        {{ visit.diagnosis_type }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    {{ visit.prescription?.length || 0 }} items
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <button (click)="viewVisit(visit)" class="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 hover:border-blue-400 bg-blue-50 px-3 py-1 rounded mr-2">
                                        View
                                    </button>
                                    <button (click)="deleteVisit(visit.id)" class="text-gray-400 hover:text-red-600 font-medium text-xs hover:bg-red-50 p-1 rounded transition opacity-0 group-hover:opacity-100">
                                        🗑
                                    </button>
                                </td>
                            </tr>
                            <tr *ngIf="visits.length === 0">
                                <td colspan="4" class="px-6 py-12 text-center text-gray-400 italic">
                                    No history found. Start a new consultation.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
             </div>
        </div>

      </div>



      <!-- Edit Patient Modal (Synced with Patient List) -->
      <div *ngIf="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg w-[800px] max-h-[90vh] shadow-xl flex flex-col overflow-hidden">
            
            <!-- Fixed Header -->
            <div class="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 class="text-xl font-bold text-gray-800">Edit Patient Details</h2>
                <button (click)="showEditModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <!-- Scrollable Body -->
            <div class="flex-1 overflow-y-auto p-6">
                <form [formGroup]="patientForm" id="patientForm" (ngSubmit)="savePatient()">
                    
                    <!-- 1. Personal Info -->
                    <div class="mb-6">
                        <h3 class="font-bold text-gray-700 border-b pb-1 mb-3">📍 Personal Information</h3>
                        <div class="grid grid-cols-2 gap-4">
                            
                            <!-- Name -->
                            <div class="col-span-1">
                                <label class="block text-sm font-medium text-gray-700">Full Name <span class="text-red-500">*</span></label>
                                <input formControlName="name" placeholder="John Doe" 
                                    class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                    [class.border-red-500]="isFieldInvalid('name')" [class.bg-red-50]="isFieldInvalid('name')">
                                <p *ngIf="isFieldInvalid('name')" class="text-xs text-red-500 mt-1">Name is required (min 3 chars, letters only).</p>
                            </div>

                            <!-- Mobile -->
                            <div class="col-span-1">
                                <label class="block text-sm font-medium text-gray-700">Mobile Number <span class="text-red-500">*</span></label>
                                <input formControlName="mobile" type="tel" inputmode="numeric" maxlength="10" placeholder="9876543210"
                                    class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    [class.border-red-500]="isFieldInvalid('mobile')" [class.bg-red-50]="isFieldInvalid('mobile')">
                                <p *ngIf="isFieldInvalid('mobile')" class="text-xs text-red-500 mt-1">Valid 10-digit mobile number required.</p>
                            </div>

                            <!-- DOB & Age Row -->
                            <div class="flex gap-4 col-span-2 items-start">
                                <!-- DOB (First) -->
                                <div class="w-1/3 relative">
                                    <label class="block text-sm font-medium text-gray-700">Date of Birth</label>
                                    <app-date-picker 
                                        formControlName="dob" 
                                        [maxDate]="today"
                                        [minDate]="minDate"
                                        placeholder="Select DOB"
                                        helperText="Auto-calculates Age">
                                    </app-date-picker>
                                </div>

                                <!-- Age -->
                                <div class="w-1/4">
                                    <label class="block text-sm font-medium text-gray-700">Age <span class="text-red-500">*</span></label>
                                    <input type="number" formControlName="age" min="0" max="110" placeholder="30"
                                        class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                        [class.border-red-500]="isFieldInvalid('age')">
                                    <p *ngIf="isFieldInvalid('age')" class="text-xs text-red-500 mt-1">Required</p>
                                </div>

                                <!-- Gender -->
                                <div class="w-1/4">
                                    <label class="block text-sm font-medium text-gray-700">Gender <span class="text-red-500">*</span></label>
                                    <select formControlName="gender" class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            [class.border-red-500]="isFieldInvalid('gender')">
                                        <option value="" disabled>Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <p *ngIf="isFieldInvalid('gender')" class="text-xs text-red-500 mt-1">Required</p>
                                </div>

                                <!-- Blood Group -->
                                <div class="w-1/6">
                                    <label class="block text-sm font-medium text-gray-700">Blood</label>
                                    <select formControlName="blood_group" class="w-full border p-2 rounded">
                                        <option value="">-</option>
                                        <option value="A+">A+</option> <option value="A-">A-</option>
                                        <option value="B+">B+</option> <option value="B-">B-</option>
                                        <option value="O+">O+</option> <option value="O-">O-</option>
                                        <option value="AB+">AB+</option> <option value="AB-">AB-</option>
                                    </select>
                                </div>
                            </div>

                            <div class="col-span-2">
                                <label class="block text-sm font-medium text-gray-700">Email (Optional)</label>
                                <input type="email" formControlName="email" placeholder="patient@example.com" class="w-full border p-2 rounded">
                                <p *ngIf="isFieldInvalid('email')" class="text-xs text-red-500 mt-1">Invalid email format.</p>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Address Info -->
                    <div class="mb-6">
                        <h3 class="font-bold text-gray-700 border-b pb-1 mb-3">🏠 Address Details</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-2">
                                <label class="block text-sm font-medium text-gray-700">Full Address <span class="text-red-500">*</span></label>
                                <textarea formControlName="address" rows="3" placeholder="House No, Street Name, Area"
                                        class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        [class.border-red-500]="isFieldInvalid('address')"></textarea>
                                <p *ngIf="isFieldInvalid('address')" class="text-xs text-red-500 mt-1">Address is required.</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700">City</label>
                                <input formControlName="city" placeholder="City" class="w-full border p-2 rounded">
                            </div>
                            
                            <div class="flex gap-2">
                                <div class="w-1/2">
                                    <label class="block text-sm font-medium text-gray-700">State</label>
                                    <input formControlName="state" class="w-full border p-2 rounded">
                                </div>
                                <div class="w-1/2">
                                    <label class="block text-sm font-medium text-gray-700">Pincode</label>
                                    <input formControlName="zip_code" maxlength="6" inputmode="numeric" placeholder="600000"
                                            class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            [class.border-red-500]="isFieldInvalid('zip_code')">
                                    <p *ngIf="isFieldInvalid('zip_code')" class="text-xs text-red-500 mt-1">Invalid Pincode (6 digits)</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Emergency Info -->
                    <div>
                        <h3 class="font-bold text-gray-700 border-b pb-1 mb-3">🚑 Emergency Contact</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Contact Name</label>
                                <input formControlName="emergency_contact_name" placeholder="Relative Name" class="w-full border p-2 rounded">
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700">Emergency Mobile</label>
                                <input formControlName="emergency_contact_mobile" type="tel" maxlength="10" placeholder="Mobile Number"
                                    class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    [class.border-red-500]="isFieldInvalid('emergency_contact_mobile')">
                                <p *ngIf="isFieldInvalid('emergency_contact_mobile')" class="text-xs text-red-500 mt-1">Invalid Mobile Number</p>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            
            <!-- Fixed Footer -->
            <div class="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
                <p class="text-xs text-gray-500"><span class="text-red-500">*</span> Required Fields</p>
                <div class="flex gap-2">
                    <button type="button" (click)="showEditModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded border bg-white transition-colors">
                        Cancel
                    </button>
                    <!-- form attribute links this button to the form above -->
                    <button type="submit" form="patientForm" 
                            [disabled]="patientForm.invalid" 
                            class="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow transition-colors">
                        Update Patient
                    </button>
                </div>
            </div>
          </div>
      </div>

      <!-- Visit Detail Modal (Receipt View) -->
      <div *ngIf="showVisitModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" (click)="closeModal()">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold text-gray-800">Medical Record</h2>
                    <p class="text-sm text-gray-500">{{ selectedVisit?.date | date:'mediumDate' }} • {{ selectedVisit?.doctor_name || 'Dr. ' + (currentUser?.name || '') }}</p>
                </div>
                <button (click)="closeModal()" class="text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 w-8 h-8 flex items-center justify-center">✕</button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="p-8 overflow-y-auto space-y-6 flex-1 font-serif">
                <!-- Header Info for Print -->
                <div class="flex justify-between items-start border-b pb-6 mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">{{ patient?.name }}</h1>
                        <p class="text-gray-600">{{ patient?.age }} / {{ patient?.gender }}</p>
                    </div>
                     <div class="text-right text-sm text-gray-500">
                        <p>ID: #{{ patient?.id }}</p>
                        <p>{{ patient?.mobile }}</p>
                    </div>
                </div>

                <!-- Diagnosis -->
                <div class="mb-6">
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Diagnosis</h4>
                    <p class="text-lg font-medium text-gray-800">
                        {{ selectedVisit?.diagnosis || 'N/A' }}
                        <span *ngIf="selectedVisit?.diagnosis_type" class="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs align-middle font-sans">{{ selectedVisit?.diagnosis_type }}</span>
                    </p>
                </div>

                <!-- Symptoms & Observations -->
                <div class="grid grid-cols-2 gap-8 mb-6">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Symptoms</h4>
                        <p class="text-gray-700 whitespace-pre-line">{{ selectedVisit?.symptoms || '-' }}</p>
                    </div>
                     <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Observations</h4>
                        <p class="text-gray-700 whitespace-pre-line">{{ selectedVisit?.examination_notes || '-' }}</p>
                    </div>
                </div>

                <!-- Prescription Table -->
                <div *ngIf="selectedVisit?.prescription?.length">
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 font-sans">Prescription</h4>
                    <table class="w-full text-sm border-collapse">
                        <thead class="bg-gray-50 font-sans text-gray-500 font-bold border-b">
                            <tr>
                                <th class="text-left py-2 px-2">Medicine</th>
                                <th class="text-left py-2 px-2">Dosage</th>
                                <th class="text-left py-2 px-2">Duration</th>
                                <th class="text-left py-2 px-2">Instr.</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr *ngFor="let item of selectedVisit.prescription">
                                <td class="py-2 px-2 font-bold text-gray-800">{{ item.medicine }}</td>
                                <td class="py-2 px-2 text-gray-600">{{ item.frequency }}</td>
                                <td class="py-2 px-2 text-gray-600">{{ item.duration }}</td>
                                <td class="py-2 px-2 text-gray-500 italic">{{ item.instructions }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Footer -->
                 <div class="mt-8 pt-8 border-t flex justify-between items-center text-xs text-gray-400 font-sans">
                    <p>Generated via NalamDesk</p>
                    <p>{{ selectedVisit?.date | date:'medium' }}</p>
                 </div>
            </div>

            <!-- Modal Footer (Actions) -->
            <div class="bg-gray-50 border-t px-6 py-4 flex justify-between items-center font-sans">
                <button (click)="closeModal()" class="text-gray-600 hover:text-gray-800 font-medium">Close</button>
                <div class="flex gap-3">

                    <button (click)="printVisit()" class="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-md transition">
                        Print Record
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  `
})
export class PatientDetailsComponent implements OnInit {
    patientId!: number;
    patient: any;
    visits: any[] = [];
    vitals: any;
    currentUser: any;

    // Modal State
    showVisitModal = false;
    selectedVisit: any = null;

    // Edit Patient Modal
    showEditModal = false;
    patientForm!: FormGroup;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private ngZone: NgZone,
        private fb: FormBuilder,
        private dataService: DataService,
        private authService: AuthService,
        private dialogService: DialogService
    ) {
        this.initForm();
    }

    get today(): string {
        return new Date().toISOString().split('T')[0];
    }

    get minDate(): string {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 110);
        return d.toISOString().split('T')[0];
    }

    isFieldInvalid(field: string): boolean {
        const control = this.patientForm.get(field);
        return !!(control && control.invalid && (control.dirty || control.touched));
    }

    initForm() {
        this.patientForm = this.fb.group({
            id: [null],
            uuid: [null],
            name: ['', [Validators.required, Validators.minLength(3)]],
            mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
            age: [null, [Validators.required, Validators.min(0), Validators.max(110)]],
            gender: ['', Validators.required],
            address: ['', [Validators.required]],
            // Extended fields
            dob: [null],
            blood_group: [''],
            email: ['', Validators.email],
            emergency_contact_name: [''],
            emergency_contact_mobile: ['', Validators.pattern(/^[0-9]{10}$/)],
            street: [''],
            city: [''],
            state: [''],
            zip_code: ['', [Validators.pattern(/^[0-9]{6}$/)]],
            insurance_provider: [''],
            policy_number: ['']
        });

        // Auto-calculate DOB from Age
        this.patientForm.get('age')?.valueChanges.subscribe(age => {
            if (age && !this.patientForm.get('dob')?.dirty) {
                const date = new Date();
                date.setFullYear(date.getFullYear() - age);
                this.patientForm.patchValue({ dob: date.toISOString().split('T')[0] }, { emitEvent: false });
            }
        });

        // Auto-calculate Age from DOB
        this.patientForm.get('dob')?.valueChanges.subscribe(dob => {
            if (dob) {
                const birthDate = new Date(dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                this.patientForm.patchValue({ age: age }, { emitEvent: false });
            }
        });
    }

    ngOnInit() {
        this.currentUser = this.authService.getUser();
        this.route.params.subscribe(params => {
            this.patientId = +params['id'];
            this.loadData();
        });
    }

    async loadData() {
        try {
            const [patient, visits, vitals] = await Promise.all([
                this.dataService.invoke<any>('getPatientById', this.patientId),
                this.dataService.invoke<any[]>('getVisits', this.patientId),
                this.dataService.invoke<any>('getVitals', this.patientId)
            ]);

            this.ngZone.run(() => {
                this.patient = patient;
                this.visits = visits;
                this.vitals = vitals;
            });
        } catch (e) {
            console.error('Failed to load patient details', e);
        }
    }

    startConsult() {
        this.router.navigate(['/visit', this.patientId], { state: { isConsulting: true } });
    }

    viewVisit(visit: any) {
        this.selectedVisit = visit;
        this.showVisitModal = true;
    }

    closeModal() {
        this.showVisitModal = false;
        this.selectedVisit = null;
    }

    editVisitFromModal() {
        if (this.selectedVisit) {
            this.router.navigate(['/visit', this.selectedVisit.id]);
        }
    }

    printVisit() {
        // Placeholder for printing logic
        window.print();
    }

    async deleteVisit(visitId: number) {
        const confirmed = await this.dialogService.open({
            title: 'Delete Visit?',
            message: 'Permanently delete this visit record? This processing cannot be undone.',
            type: 'confirm',
            confirmText: 'Delete Forever',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            try {
                await this.dataService.invoke('deleteVisit', visitId);
                this.loadData();
            } catch (e) {
                console.error(e);
                this.dialogService.open({
                    title: 'Error',
                    message: 'Failed to delete visit.',
                    type: 'error'
                });
            }
        }
    }

    async deletePatient() {
        const confirmed = await this.dialogService.open({
            title: 'Delete Patient?',
            message: 'Are you sure you want to delete this patient? All their visits, vitals, and history will be permanently deleted.',
            type: 'confirm',
            confirmText: 'Delete Patient',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            try {
                await this.dataService.invoke('deletePatient', this.patientId);
                this.router.navigate(['/patients']);
            } catch (e) {
                console.error(e);
                this.dialogService.open({
                    title: 'Error',
                    message: 'Failed to delete patient.',
                    type: 'error'
                });
            }
        }
    }

    goBack() {
        this.router.navigate(['/patients']);
    }

    openEditModal() {
        if (this.patient) {
            this.patientForm.patchValue(this.patient);
            this.showEditModal = true;
        }
    }

    async savePatient() {
        if (this.patientForm.invalid) {
            this.patientForm.markAllAsTouched();
            return;
        }
        try {
            await this.dataService.invoke('savePatient', this.patientForm.value);
            this.showEditModal = false;
            this.loadData();
            this.dialogService.open({
                title: 'Success',
                message: 'Patient updated successfully.',
                type: 'success'
            });
        } catch (e) {
            console.error(e);
            this.dialogService.open({
                title: 'Error',
                message: 'Failed to update patient.',
                type: 'error'
            });
        }
    }
}

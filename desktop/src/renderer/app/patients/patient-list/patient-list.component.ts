import { Component, NgZone, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Patient, PatientService } from '../../services/patient.service';
import { DataService } from '../../services/api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../shared/services/dialog.service';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerComponent],
  template: `
    <div class="h-full bg-gray-100 p-6 flex flex-col overflow-hidden">
      <div class="w-full">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold text-gray-800">Patients</h1>
          <button (click)="openAddModal()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            + Add Patient
          </button>
        </div>

        <!-- Search Bar -->
        <div class="mb-6 relative">
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            (ngModelChange)="onSearch()"
            placeholder="Search by name or mobile..." 
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        <!-- Data Table (Scrollable Container) -->
        <div class="bg-white rounded-lg shadow flex-1 overflow-auto relative">
          <table class="min-w-full">
            <thead class="bg-gray-50 text-gray-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Mobile</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Age/Gender</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr *ngFor="let patient of patients" class="hover:bg-gray-50 cursor-pointer" (click)="goToVisit(patient)">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ patient.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ patient.mobile }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ patient.age }} / {{ patient.gender }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button 
                    (click)="addToQueue(patient); $event.stopPropagation()" 
                    [disabled]="isEnqueued(patient)"
                    [class.text-gray-400]="isEnqueued(patient)"
                    [class.text-green-600]="!isEnqueued(patient)"
                    class="hover:text-green-900 mr-4 font-medium disabled:cursor-not-allowed">
                    {{ isEnqueued(patient) ? 'In Queue' : 'Add to Queue' }}
                  </button>
                  <button (click)="editPatient(patient); $event.stopPropagation()" class="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                </td>
              </tr>
              <tr *ngIf="patients.length === 0">
                <td colspan="4" class="px-6 py-4 text-center text-gray-500">No patients found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add Patient Modal -->
      <div *ngIf="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg w-[800px] max-h-[90vh] shadow-xl flex flex-col overflow-hidden">
            
            <!-- Fixed Header -->
            <div class="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 class="text-xl font-bold text-gray-800">{{ isEditMode ? 'Edit Patient Details' : 'New Patient Registration' }}</h2>
                <button (click)="showModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
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
                    <button type="button" (click)="showModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded border bg-white transition-colors">
                        Cancel
                    </button>
                    <!-- form attribute links this button to the form above -->
                    <button type="submit" form="patientForm" 
                            [disabled]="patientForm.invalid" 
                            class="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow transition-colors">
                        {{ isEditMode ? 'Update Patient' : 'Save Patient' }}
                    </button>
                </div>
            </div>
        </div>
      </div>


    </div>
  `,
  styles: []
})
export class PatientListComponent implements OnInit {
  patients: Patient[] = [];
  searchQuery = '';
  showModal = false;

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get minDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 110);
    return d.toISOString().split('T')[0];
  }

  get isEditMode(): boolean {
    return !!this.patientForm.get('id')?.value;
  }

  private dataService: DataService = inject(DataService);
  private authService: AuthService = inject(AuthService);
  currentUser: any = null;
  private dialogService = inject(DialogService);

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private ngZone: NgZone,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
    this.initForm();
  }

  patientForm!: FormGroup;

  initForm() {
    this.patientForm = this.fb.group({
      id: [null],
      uuid: [null],
      name: ['', [Validators.required, Validators.minLength(3)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      age: [null, [Validators.required, Validators.min(0), Validators.max(110)]],
      dob: [null],
      gender: ['Male', Validators.required],
      blood_group: [''],
      email: ['', [Validators.email]],

      // Address
      address: ['', Validators.required],
      street: [''],
      city: [''],
      state: [''],
      zip_code: ['', [Validators.pattern(/^[0-9]{6}$/)]],

      // Emergency
      emergency_contact_name: [''],
      emergency_contact_mobile: ['', [Validators.pattern(/^[0-9]{10}$/)]],

      // Insurance
      insurance_provider: [''],
      policy_number: ['']
    });

    this.patientForm.get('dob')?.valueChanges.subscribe(dob => {
      if (dob) {
        const age = this.calculateAge(new Date(dob));
        this.patientForm.patchValue({ age }, { emitEvent: false });
      }
    });
  }

  calculateAge(dob: Date): number {
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.loadPatients();
    this.loadQueueStatus();

    this.route.queryParams.subscribe(params => {
      if (params['editId']) {
        const id = Number(params['editId']);
        setTimeout(() => {
          const p = this.patients.find(pt => pt.id === id);
          if (p) {
            this.editPatient(p);
          }
        }, 500);
      }
    });
  }

  async loadPatients() {
    try {
      const data = await this.patientService.getPatients(this.searchQuery);
      this.ngZone.run(() => {
        this.patients = data;
      });
    } catch (e) {
      console.error('Failed to load patients', e);
    }
  }

  async loadQueueStatus() {
    try {
      const queue = await this.dataService.invoke<any>('getQueue');
      this.enqueuedPatientIds.clear();
      queue.forEach((item: any) => {
        if (item.status !== 'completed') {
          this.enqueuedPatientIds.add(Number(item.patient_id));
        }
      });
    } catch (e) {
      console.error('Failed to load queue status', e);
    }
  }

  onSearch() {
    this.loadPatients();
  }

  openAddModal() {
    this.patientForm.reset({ gender: 'Male', age: 0 });
    this.showModal = true;
  }

  editPatient(patient: Patient) {
    this.patientForm.patchValue(patient);
    this.showModal = true;
  }

  async savePatient() {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      return;
    }

    try {
      const formValue = this.patientForm.value;
      const result = await this.patientService.savePatient(formValue);
      this.ngZone.run(() => {
        this.showModal = false;
        this.loadPatients();
      });
    } catch (e) {
      console.error('Failed to save patient', e);
    }
  }

  goToVisit(patient: Patient) {
    this.router.navigate(['/patients', patient.id]);
  }

  enqueuedPatientIds = new Set<number>();

  async addToQueue(patient: Patient) {
    if (this.isEnqueued(patient)) return;

    // Strict Validation
    if (!this.patientService.isPatientComplete(patient)) {
      await this.dialogService.open({
        title: 'Incomplete Details',
        message: 'Patient details incomplete (Age, Gender, Address etc. required). Please update details first.',
        type: 'warning',
        confirmText: 'Edit Now'
      });
      this.editPatient(patient);
      return;
    }

    try {
      await this.dataService.invoke<any>('addToQueue', { patientId: patient.id!, priority: 1 });
      this.ngZone.run(() => {
        this.enqueuedPatientIds.add(Number(patient.id!));
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      console.error(e);
      // If error is "Patient already in queue", we should update our local state
      this.ngZone.run(async () => {
        if (e.message && e.message.includes('already in queue')) {
          this.enqueuedPatientIds.add(patient.id!);
          this.cdr.detectChanges();
        } else {
          await this.dialogService.open({
            title: 'Error',
            message: 'Failed to add to queue: ' + e.message,
            type: 'error'
          });
        }
      });
    }
  }

  isEnqueued(patient: Patient): boolean {
    return this.enqueuedPatientIds.has(patient.id!);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.patientForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

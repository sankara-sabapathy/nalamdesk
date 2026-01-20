import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";


@Component({
  selector: 'app-visit',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
            <p class="font-semibold">{{ visit.diagnosis }}</p>
            <div class="text-xs text-gray-600 mt-1">
              <span *ngFor="let med of visit.prescription" class="block">
                • {{ med.name }} - {{ med.dosage }}
              </span>
            </div>
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
        
        <form [formGroup]="visitForm" (ngSubmit)="saveVisit()">
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Diagnosis / Symptoms</label>
            <textarea formControlName="diagnosis" rows="3" class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"></textarea>
          </div>

          <div class="mb-6">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm font-medium text-gray-700">Prescription</label>
              <button type="button" (click)="addMedicine()" class="text-blue-600 text-sm hover:underline">+ Add Medicine</button>
            </div>
            
            <div formArrayName="prescription" class="space-y-2">
              <div *ngFor="let med of medicines.controls; let i=index" [formGroupName]="i" class="flex gap-2 items-start">
                <input formControlName="name" placeholder="Medicine Name" class="flex-grow border p-2 rounded">
                <input formControlName="dosage" placeholder="Dosage (e.g. 1-0-1)" class="w-32 border p-2 rounded">
                <input formControlName="frequency" placeholder="Freq" class="w-24 border p-2 rounded">
                <input formControlName="duration" placeholder="Days" class="w-20 border p-2 rounded">
                <button type="button" (click)="removeMedicine(i)" class="text-red-500 p-2">×</button>
              </div>
            </div>
          </div>

          <div class="mb-6 w-48">
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount Paid (₹)</label>
            <input type="number" formControlName="amount_paid" class="w-full border p-2 rounded">
          </div>

          <div class="flex gap-4">
            <button type="submit" [disabled]="!visitForm.valid" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition">
              Save Visit
            </button>
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private ngZone: NgZone
  ) {
    this.visitForm = this.fb.group({
      diagnosis: ['', Validators.required],
      prescription: this.fb.array([]),
      amount_paid: [0]
    });
    this.addMedicine(); // Start with one row
  }

  get medicines() {
    return this.visitForm.get('prescription') as FormArray;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.patientId = +params['id'];
      this.loadData();
    });
  }

  editVisit(visit: any) {
    this.editingVisitId = visit.id;
    this.visitForm.patchValue({
      diagnosis: visit.diagnosis,
      amount_paid: visit.amount_paid
    });

    this.medicines.clear();
    if (visit.prescription && visit.prescription.length > 0) {
      visit.prescription.forEach((med: any) => {
        this.medicines.push(this.fb.group({
          name: [med.name, Validators.required],
          dosage: [med.dosage],
          frequency: [med.frequency],
          duration: [med.duration]
        }));
      });
    } else {
      this.addMedicine();
    }
  }

  resetForm() {
    this.editingVisitId = null;
    this.visitForm.reset({ amount_paid: 0 });
    this.medicines.clear();
    this.addMedicine();
  }

  async loadData() {
    try {
      const visits = await window.electron.db.getVisits(this.patientId);
      const allPatients = await window.electron.db.getPatients('');
      const p = allPatients.find((p: any) => p.id === this.patientId);
      this.ngZone.run(() => {
        this.patient = p;
        this.history = visits;
      });
    } catch (e) {
      console.error(e);
    }
  }

  addMedicine() {
    const medGroup = this.fb.group({
      name: ['', Validators.required],
      dosage: [''],
      frequency: [''],
      duration: ['']
    });
    this.medicines.push(medGroup);
  }

  removeMedicine(index: number) {
    this.medicines.removeAt(index);
  }

  async saveVisit() {
    if (this.visitForm.invalid) return;

    // Get active doctor
    const doctorId = localStorage.getItem('selectedDoctorId');

    const visitData = {
      id: this.editingVisitId, // If editing
      patient_id: this.patientId,
      doctor_id: doctorId ? +doctorId : null,
      ...this.visitForm.value
    };

    try {
      await window.electron.db.saveVisit(visitData);
      this.ngZone.run(() => {
        this.resetForm();
        this.loadData();
      });
    } catch (e) {
      console.error('Save failed', e);
    }
  }

  async deleteVisit() {
    if (!this.editingVisitId) return;
    if (confirm('Are you sure you want to delete this visit?')) {
      try {
        await window.electron.db.deleteVisit(this.editingVisitId);
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

  printPrescription() {
    // Lazy load or assign vfs
    if (!(pdfMake as any).vfs) {
      // pdfFonts might be the vfs object itself (webpack/angular issue)
      const vfs = (pdfFonts as any).default || pdfFonts;
      if (vfs) {
        (pdfMake as any).vfs = vfs;
      } else {
        console.warn('pdfMake vfs not found', pdfFonts);
      }
    }

    const docDefinition: any = {
      content: [
        { text: 'Prescription', style: 'header' },
        { text: this.patient?.name + ' (Age: ' + this.patient?.age + ')', margin: [0, 10, 0, 10] },
        { text: 'Diagnosis: ' + this.visitForm.value.diagnosis, margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['Medicine', 'Dosage', 'Freq', 'Duration'],
              ...this.visitForm.value.prescription.map((m: any) => [m.name, m.dosage, m.frequency, m.duration])
            ]
          }
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true }
      }
    };
    pdfMake.createPdf(docDefinition).open();
  }

  goBack() {
    this.router.navigate(['/patients']);
  }
}

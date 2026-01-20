import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Patient, PatientService } from '../../services/patient.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="max-w-7xl mx-auto">
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

        <!-- Data Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full">
            <thead class="bg-gray-50 text-gray-700">
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
                  <button (click)="editPatient(patient); $event.stopPropagation()" class="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                  <button (click)="confirmDelete(patient.id!); $event.stopPropagation()" class="text-red-600 hover:text-red-900 mr-4">Delete</button>
                  <button (click)="goToVisit(patient); $event.stopPropagation()" class="text-blue-600 hover:text-blue-900">Visit</button>
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
        <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
          <h2 class="text-xl font-bold mb-4">New Patient</h2>
          <form (ngSubmit)="savePatient()">
            <div class="mb-2">
              <label class="block text-sm font-medium text-gray-700">Name</label>
              <input [(ngModel)]="newPatient.name" name="name" class="w-full border p-2 rounded" required>
            </div>
            <div class="mb-2">
              <label class="block text-sm font-medium text-gray-700">Mobile</label>
              <input [(ngModel)]="newPatient.mobile" name="mobile" class="w-full border p-2 rounded" required>
            </div>
            <div class="flex gap-2 mb-2">
              <div class="w-1/2">
                <label class="block text-sm font-medium text-gray-700">Age</label>
                <input type="number" [(ngModel)]="newPatient.age" name="age" class="w-full border p-2 rounded" required>
              </div>
              <div class="w-1/2">
                <label class="block text-sm font-medium text-gray-700">Gender</label>
                <select [(ngModel)]="newPatient.gender" name="gender" class="w-full border p-2 rounded">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
             <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700">Address</label>
              <textarea [(ngModel)]="newPatient.address" name="address" class="w-full border p-2 rounded"></textarea>
            </div>
            
            <div class="flex justify-end gap-2">
              <button type="button" (click)="showModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 class="text-xl font-bold mb-4 text-red-600">Delete Patient?</h2>
            <p class="text-gray-600 mb-6">Are you sure you want to delete this patient? All their visits and history will be permanently deleted.</p>
            <div class="flex justify-end gap-2">
                <button (click)="cancelDelete()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button (click)="executeDelete()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete Permanently</button>
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

  newPatient: Patient = {
    name: '',
    mobile: '',
    age: 0,
    gender: 'Male',
    address: ''
  };

  constructor(
    private patientService: PatientService,
    private ngZone: NgZone,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadPatients();
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

  onSearch() {
    this.loadPatients();
  }

  openAddModal() {
    this.newPatient = { name: '', mobile: '', age: 0, gender: 'Male', address: '' };
    this.showModal = true;
  }

  editPatient(patient: Patient) {
    this.newPatient = { ...patient };
    this.showModal = true;
  }

  async savePatient() {
    try {
      const result = await this.patientService.savePatient(this.newPatient);
      this.ngZone.run(() => {
        this.showModal = false;
        this.loadPatients();
      });
    } catch (e) {
      console.error('Failed to save patient', e);
    }
  }

  goToVisit(patient: Patient) {
    this.router.navigate(['/visit', patient.id]);
  }

  // Delete Modal State
  showDeleteModal = false;
  patientToDeleteId: number | null = null;

  confirmDelete(id: number) {
    this.patientToDeleteId = id;
    this.showDeleteModal = true;
  }

  async executeDelete() {
    if (this.patientToDeleteId) {
      try {
        await window.electron.db.deletePatient(this.patientToDeleteId);
        this.loadPatients();
        this.showDeleteModal = false;
        this.patientToDeleteId = null;
      } catch (e) {
        console.error(e);
        alert('Failed to delete patient');
      }
    }
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.patientToDeleteId = null;
  }
}

import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <nav class="bg-blue-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <span class="font-bold text-xl cursor-pointer" routerLink="/dashboard">
              {{ clinicName || 'NalamDesk' }}
            </span>
            <div class="ml-10 flex items-baseline space-x-4">
              <a routerLink="/dashboard" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Dashboard</a>
              <a routerLink="/patients" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Patients</a>
              <a routerLink="/settings" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Settings</a>
            </div>
          </div>
          <div class="flex items-center gap-4">
             <!-- Doctor Selector -->
             <select *ngIf="doctors.length > 0" [(ngModel)]="selectedDoctorId" (change)="onDoctorChange()" class="bg-blue-700 border-none text-white text-sm rounded px-3 py-1 focus:ring-2 focus:ring-blue-400">
                <option [ngValue]="null">Select Doctor</option>
                <option *ngFor="let doc of doctors" [ngValue]="doc.id">{{ doc.name }}</option>
             </select>
             <span *ngIf="doctors.length === 0" class="text-xs text-blue-200">No Doctors Configured</span>

             <button (click)="logout()" class="bg-blue-800 px-3 py-1 rounded text-sm hover:bg-blue-900 transition">Logout</button>
          </div>
        </div>
      </div>
    </nav>
  `,
  styles: []
})
export class NavbarComponent implements OnInit {
  clinicName = '';
  doctors: any[] = [];
  selectedDoctorId: number | null = null;

  constructor(private router: Router, private ngZone: NgZone) { }

  ngOnInit() {
    this.loadSettings();
    this.loadDoctors();
  }

  async loadSettings() {
    try {
      const settings = await window.electron.db.getSettings();
      this.ngZone.run(() => {
        if (settings) {
          this.clinicName = settings.clinic_name;
        }
      });
    } catch (e) { console.error(e); }
  }

  async loadDoctors() {
    try {
      const docs = await window.electron.db.getDoctors();
      this.ngZone.run(() => {
        this.doctors = docs;
        // Auto-select if stored or single
        const stored = localStorage.getItem('selectedDoctorId');
        if (stored) {
          this.selectedDoctorId = +stored;
        } else if (docs.length > 0) {
          this.selectedDoctorId = docs[0].id;
          this.onDoctorChange();
        }
      });
    } catch (e) { console.error(e); }
  }

  onDoctorChange() {
    if (this.selectedDoctorId) {
      localStorage.setItem('selectedDoctorId', this.selectedDoctorId.toString());
    } else {
      localStorage.removeItem('selectedDoctorId');
    }
  }

  logout() {
    this.router.navigate(['/login']);
  }
}

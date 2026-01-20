import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-screen bg-gray-50 p-8">
      <div class="max-w-7xl mx-auto">
        
        <!-- Header Section -->
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-800">Welcome, {{ doctorName || 'Doctor' }}</h1>
                <p class="text-gray-500">{{ clinicName || 'NalamDesk Clinic' }}</p>
            </div>
            <div class="text-right">
                <p class="text-2xl font-mono font-bold text-blue-600">{{ currentTime | date:'shortTime' }}</p>
                <p class="text-sm text-gray-500">{{ currentTime | date:'fullDate' }}</p>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Total Patients -->
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <h3 class="text-blue-100 font-medium mb-1">Total Patients</h3>
            <p class="text-4xl font-bold">{{ stats.totalPatients }}</p>
          </div>

          <!-- Today's Visits -->
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <h3 class="text-green-100 font-medium mb-1">Visits Today</h3>
            <p class="text-4xl font-bold">{{ stats.todayVisits }}</p>
          </div>

           <!-- Quick Action -->
           <div class="bg-white rounded-xl shadow-lg p-6 flex flex-col justify-center items-start cursor-pointer hover:shadow-xl transition border border-gray-100" (click)="goToPatients()">
            <h3 class="text-gray-500 font-medium mb-2">Next Patient?</h3>
            <button class="bg-blue-600 text-white w-full py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
                Start New Visit
            </button>
          </div>
        </div>

        <!-- Secondary Actions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition cursor-pointer" (click)="goToPatients()">
            <h2 class="text-lg font-semibold mb-2 text-gray-800">Patient Queue</h2>
            <p class="text-gray-500 text-sm">Manage patient records and start consultations.</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition cursor-pointer" (click)="goToSettings()">
            <h2 class="text-lg font-semibold mb-2 text-gray-800">Settings & Backup</h2>
            <p class="text-gray-500 text-sm">Configure clinic details and manage Google Drive backups.</p>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: []
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentTime = new Date();
  timer: any;
  clinicName = '';
  doctorName = '';
  stats = { totalPatients: 0, todayVisits: 0 };

  constructor(private router: Router, private ngZone: NgZone) { }

  ngOnInit() {
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    this.loadData();
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async loadData() {
    try {
      const settings = await window.electron.db.getSettings();
      const stats = await window.electron.db.getDashboardStats();

      this.ngZone.run(() => {
        if (settings) {
          this.clinicName = settings.clinic_name;
          this.doctorName = settings.doctor_name;
        }
        this.stats = stats;
      });
    } catch (e) {
      console.error(e);
    }
  }

  goToPatients() {
    this.router.navigate(['/patients']);
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }
}

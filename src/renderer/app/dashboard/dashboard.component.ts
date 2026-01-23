import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  // ... (template omitted, same as before) 
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto max-w-7xl">
        <!-- Welcome Section -->
        <div class="mb-8 mt-2">
            <h1 class="text-3xl font-display font-bold text-base-content">
                Good {{ getTimeOfDay() }}, <span class="text-primary">{{ currentUser?.name || doctorName || 'Doctor' }}</span>
            </h1>
            <p class="text-base-content/60 mt-1">Here's what's happening at {{ clinicName || 'your clinic' }} today.</p>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Total Patients -->
          <div class="stat bg-base-100 shadow-sm border border-base-200 rounded-2xl group hover:border-primary/20 transition-all duration-300">
            <div class="stat-figure text-primary opacity-20 group-hover:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <div class="stat-title text-base-content/60 font-medium tracking-wide text-xs uppercase">Total Patients</div>
            <div class="stat-value text-primary font-display">{{ stats.totalPatients }}</div>
            <div class="stat-desc text-base-content/40">Registered in system</div>
          </div>

          <!-- Today's Visits -->
          <div class="stat bg-base-100 shadow-sm border border-base-200 rounded-2xl group hover:border-secondary/20 transition-all duration-300">
            <div class="stat-figure text-secondary opacity-20 group-hover:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <div class="stat-title text-base-content/60 font-medium tracking-wide text-xs uppercase">Visits Today</div>
            <div class="stat-value text-secondary font-display">{{ stats.todayVisits }}</div>
            <div class="stat-desc text-base-content/40">Checked in so far</div>
          </div>

           <!-- Quick Action -->
           <div class="card bg-primary text-primary-content shadow-lg shadow-primary/20 rounded-2xl cursor-pointer hover:shadow-xl hover:shadow-primary/30 transition-all duration-300" (click)="goToPatients()">
            <div class="card-body p-6 relative overflow-hidden">
                <!-- Background decoration -->
                <div class="absolute -right-4 -bottom-4 opacity-20">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-32 h-32 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </div>
                
                <div class="relative z-10">
                     <div class="font-medium tracking-wide text-xs uppercase opacity-80 mb-1">Quick Action</div>
                     <h3 class="text-2xl font-bold mb-4">New Visit</h3>
                     <button class="btn btn-sm btn-circle bg-white/20 hover:bg-white/30 text-white border-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                     </button>
                </div>
            </div>
           </div>
        </div>

        <!-- Secondary Actions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="card bg-base-100 shadow-sm border border-base-200 hover:border-primary/30 transition-colors cursor-pointer" (click)="goToQueue()">
            <div class="card-body flex-row items-center gap-4">
                <div class="p-3 bg-secondary/10 rounded-xl text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h2 class="card-title text-base font-bold">Patient Queue</h2>
                    <p class="text-sm text-base-content/60">Manage waiting list and consultations</p>
                </div>
                <div class="ml-auto" *ngIf="waitingCount > 0">
                    <span class="badge badge-error gap-1 font-bold">
                        {{ waitingCount }}
                        <span class="hidden sm:inline">Waiting</span>
                    </span>
                </div>
            </div>
          </div>

          <div *ngIf="currentUser?.role === 'admin'" class="card bg-base-100 shadow-sm border border-base-200 hover:border-primary/30 transition-colors cursor-pointer" (click)="goToSettings()">
            <div class="card-body flex-row items-center gap-4">
                <div class="p-3 bg-neutral/10 rounded-xl text-neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                     <h2 class="card-title text-base font-bold">Settings & Backup</h2>
                    <p class="text-sm text-base-content/60">Configure details and backups</p>
                </div>
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
  waitingCount = 0;
  currentUser: any = null;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private dataService: DataService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    this.loadData();
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getTimeOfDay(): string {
    const hours = this.currentTime.getHours();
    if (hours < 12) return 'Morning';
    if (hours < 18) return 'Afternoon';
    return 'Evening';
  }

  async loadData() {
    try {
      const settings = await this.dataService.invoke<any>('getSettings');
      const stats = await this.dataService.invoke<any>('getDashboardStats');
      const queue = await this.dataService.invoke<any>('getQueue');

      this.ngZone.run(() => {
        if (settings) {
          this.clinicName = settings.clinic_name;
          this.doctorName = settings.doctor_name;
        }
        this.stats = stats;
        this.waitingCount = queue.length;
      });
    } catch (e) {
      console.error(e);
    }
  }

  goToPatients() {
    this.router.navigate(['/patients']);
  }

  goToQueue() {
    this.router.navigate(['/queue']);
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }
}

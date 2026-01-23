import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  // ... (omitted)
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <nav class="bg-blue-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <img src="assets/logo.png" alt="Logo" class="h-8 w-8 mr-3 rounded bg-white p-1">
            <span class="font-bold text-xl cursor-pointer" routerLink="/dashboard">
              {{ clinicName || 'NalamDesk' }}
            </span>
            <div class="ml-10 flex items-baseline space-x-4">
              <a routerLink="/dashboard" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Dashboard</a>
              <a routerLink="/queue" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Queue</a>
              <a routerLink="/patients" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Patients</a>
              <a *ngIf="currentUser?.role === 'admin'" routerLink="/settings" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Settings</a>
            </div>
          </div>
          <div class="flex items-center gap-4">
             <div class="flex items-center gap-2 text-sm">
                 <div class="text-right">
                     <p class="font-bold">{{ currentUser?.name }}</p>
                     <p class="text-xs text-blue-200 uppercase">{{ currentUser?.role }}</p>
                 </div>
                 <div class="avatar placeholder">
                     <div class="bg-blue-800 text-white rounded-full w-8">
                         <span>{{ currentUser?.name?.charAt(0) }}</span>
                     </div>
                 </div>
             </div>
             
             <button (click)="logout()" class="text-blue-200 hover:text-white text-sm">Logout</button>
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

  currentUser: any = null;
  private dataService: DataService = inject(DataService);
  private authService: AuthService = inject(AuthService);

  constructor(private router: Router, private ngZone: NgZone) { }

  ngOnInit() {
    this.loadSettings();
    this.currentUser = this.authService.getUser();
    if (this.currentUser?.role === 'doctor') {
      // Auto-filter logic if needed, or UI hides global queue
    }
  }

  async loadSettings() {
    try {
      const settings = await this.dataService.invoke<any>('getSettings');
      this.ngZone.run(() => {
        if (settings) {
          this.clinicName = settings.clinic_name;
        }
      });
    } catch (e) { console.error(e); }
  }

  async loadDoctors() {
    try {
      const docs = await this.dataService.invoke<any>('getDoctors');
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

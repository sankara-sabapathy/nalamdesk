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
    <nav class="bg-blue-600 text-white shadow-lg sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <button (click)="toggleMobileMenu()" class="md:hidden p-2 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white mr-2">
              <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path *ngIf="!isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path *ngIf="isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <img src="assets/logo.png" alt="Logo" class="h-8 w-8 mr-3 rounded bg-white p-1 hidden md:block">
            <span class="font-bold text-xl cursor-pointer" routerLink="/dashboard">
              {{ clinicName || 'NalamDesk' }}
            </span>
            
            <!-- Desktop Nav -->
            <div class="hidden md:flex ml-10 items-baseline space-x-4">
              <a routerLink="/dashboard" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Dashboard</a>
              <a routerLink="/queue" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Queue</a>
              <a routerLink="/patients" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Patients</a>
              <a *ngIf="currentUser?.role === 'admin'" routerLink="/settings" routerLinkActive="bg-blue-700" class="px-3 py-2 rounded-md hover:bg-blue-500 transition">Settings</a>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
             <div class="hidden md:flex items-center gap-4 text-sm">
                 <div *ngIf="localIp" class="flex items-center gap-2 bg-blue-700/50 px-3 py-1 rounded-full border border-blue-500/30">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span class="font-mono text-xs text-blue-100 font-medium">http://{{localIp}}:3000</span>
                 </div>

                 <div class="text-right">
                     <p class="font-bold">{{ currentUser?.name }}</p>
                     <p class="text-xs text-blue-200 uppercase">{{ currentUser?.role }}</p>
                 </div>
                 <div class="avatar placeholder">
                     <div class="bg-blue-800 text-white rounded-full w-8 h-8 flex items-center justify-center">
                         <span>{{ currentUser?.name?.charAt(0) }}</span>
                     </div>
                 </div>
             </div>
             
             <button (click)="logout()" class="text-blue-200 hover:text-white text-sm hidden md:block">Logout</button>
          </div>
        </div>
      </div>

      <!-- Mobile Menu (Overlay) -->
      <div *ngIf="isMobileMenuOpen" class="md:hidden fixed inset-0 z-40 bg-gray-800 bg-opacity-75" (click)="closeMobileMenu()"></div>

      <!-- Mobile Menu (Drawer) -->
      <div [class.translate-x-0]="isMobileMenuOpen" [class.-translate-x-full]="!isMobileMenuOpen" 
           class="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white text-gray-900 shadow-xl transition-transform duration-300 ease-in-out flex flex-col">
        
        <div class="p-4 border-b bg-blue-600 text-white flex items-center justify-between">
           <div class="flex items-center gap-3">
             <div class="h-8 w-8 rounded bg-white text-blue-600 flex items-center justify-center font-bold">
               {{ currentUser?.name?.charAt(0) }}
             </div>
             <div>
               <p class="font-bold">{{ currentUser?.name }}</p>
               <p class="text-xs opacity-80 uppercase">{{ currentUser?.role }}</p>
             </div>
           </div>
           <button (click)="closeMobileMenu()" class="text-white">✕</button>
        </div>

        <div class="flex-1 overflow-y-auto py-4">
          <a routerLink="/dashboard" routerLinkActive="bg-blue-50 text-blue-700 border-l-4 border-blue-600" (click)="closeMobileMenu()" 
             class="block px-4 py-3 text-base font-medium hover:bg-gray-50 transition border-l-4 border-transparent">Dashboard</a>
          
          <a routerLink="/queue" routerLinkActive="bg-blue-50 text-blue-700 border-l-4 border-blue-600" (click)="closeMobileMenu()"
             class="block px-4 py-3 text-base font-medium hover:bg-gray-50 transition border-l-4 border-transparent">Queue</a>
          
          <a routerLink="/patients" routerLinkActive="bg-blue-50 text-blue-700 border-l-4 border-blue-600" (click)="closeMobileMenu()"
             class="block px-4 py-3 text-base font-medium hover:bg-gray-50 transition border-l-4 border-transparent">Patients</a>
          
          <a *ngIf="currentUser?.role === 'admin'" routerLink="/settings" routerLinkActive="bg-blue-50 text-blue-700 border-l-4 border-blue-600" (click)="closeMobileMenu()"
             class="block px-4 py-3 text-base font-medium hover:bg-gray-50 transition border-l-4 border-transparent">Settings</a>
        </div>

        <div class="p-4 border-t">
          <button (click)="logout()" class="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
            Logout
          </button>
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
  isMobileMenuOpen = false;

  localIp = '';
  isElectron = !!(window as any).electron;

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

    if (this.isElectron) {
      this.loadLocalIp();
    }
  }

  async loadLocalIp() {
    try {
      console.log('[Navbar] Loading local IP...');
      const ip = await (window as any).electron.utils.getLocalIp();
      console.log('[Navbar] Local IP received:', ip);
      this.ngZone.run(() => {
        this.localIp = ip;
      });
    } catch (e) {
      console.error('Failed to load local IP', e);
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  // ... existing methods ...


  closeMobileMenu() {
    // Immediate close to ensure UI responsiveness. 
    // Router navigation will happen in parallel.
    this.isMobileMenuOpen = false;
  }

  async loadSettings() {
    try {
      const settings = await this.dataService.invoke<any>('getPublicSettings');
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

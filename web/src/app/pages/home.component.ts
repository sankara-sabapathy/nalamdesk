import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Clinic } from '../api.service';
import { BookingModalComponent } from '../components/booking-modal.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, BookingModalComponent],
    template: `
    <div class="min-h-screen bg-slate-50 font-sans">
      <!-- Hero Section -->
      <header class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16 px-4 text-center">
        <h1 class="text-4xl md:text-5xl font-bold mb-4">Find Your NalamDesk Doctor</h1>
        <p class="text-blue-100 text-lg max-w-2xl mx-auto">Book appointments instantly with top-rated clinics near you.</p>
        
        <!-- Search Bar -->
        <div class="mt-8 max-w-xl mx-auto relative">
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (input)="filterClinics()"
            placeholder="Search by clinic name, city or specialty..." 
            class="w-full px-6 py-4 rounded-full shadow-lg text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all text-lg"
          >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute right-5 top-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>

      <!-- Clinic List -->
      <main class="max-w-6xl mx-auto px-4 py-12">
        <div *ngIf="loading" class="text-center py-20 text-slate-500">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Loading clinics...
        </div>

        <div *ngIf="!loading && filteredClinics.length === 0" class="text-center py-20 text-slate-500">
          <p class="text-xl">No clinics found matching "{{searchTerm}}"</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div *ngFor="let clinic of filteredClinics" class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 overflow-hidden group">
            <div class="h-32 bg-slate-100 relative overflow-hidden">
               <!-- Placeholder Pattern -->
               <div class="absolute inset-0 bg-blue-50 opacity-50 group-hover:scale-105 transition-transform duration-500"></div>
               <div class="absolute bottom-4 left-4 bg-white px-3 py-1 rounded-full text-xs font-bold text-blue-600 uppercase tracking-wider shadow-sm">
                 {{ clinic.specialty || 'General Practice' }}
               </div>
            </div>
            
            <div class="p-6">
              <div class="flex justify-between items-start mb-2">
                <h3 class="text-xl font-bold text-slate-800">{{ clinic.name }}</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" *ngIf="isOnline(clinic.last_seen)">
                  Online
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600" *ngIf="!isOnline(clinic.last_seen)">
                  Offline
                </span>
              </div>
              
              <p class="text-slate-500 flex items-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ clinic.city }}
              </p>

              <button (click)="openBooking(clinic)" class="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center">
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <!-- Footer -->
      <footer class="bg-white border-t border-slate-200 mt-12 py-8 text-center text-slate-400 text-sm">
        &copy; 2026 NalamDesk Health Platform.
      </footer>

      <!-- Modal -->
      <app-booking-modal 
        *ngIf="selectedClinic" 
        [clinic]="selectedClinic" 
        (close)="selectedClinic = null">
      </app-booking-modal>
    </div>
  `
})
export class HomeComponent implements OnInit {
    clinics: Clinic[] = [];
    filteredClinics: Clinic[] = [];
    searchTerm: string = '';
    loading = true;
    selectedClinic: Clinic | null = null;

    constructor(private api: ApiService) { }

    ngOnInit() {
        this.api.getClinics().subscribe({
            next: (data) => {
                this.clinics = data;
                this.filteredClinics = data;
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
            }
        });
    }

    filterClinics() {
        const term = this.searchTerm.toLowerCase();
        this.filteredClinics = this.clinics.filter(c =>
            c.name.toLowerCase().includes(term) ||
            c.city.toLowerCase().includes(term) ||
            (c.specialty || '').toLowerCase().includes(term)
        );
    }

    isOnline(lastSeen: string): boolean {
        const diff = new Date().getTime() - new Date(lastSeen).getTime();
        return diff < 5 * 60 * 1000; // Passed 5 minutes considered online
    }

    openBooking(clinic: Clinic) {
        this.selectedClinic = clinic;
    }
}

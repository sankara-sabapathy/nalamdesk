import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Clinic, Slot } from '../api.service';

@Component({
  selector: 'app-booking-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" (click)="close.emit()"></div>

      <div class="flex items-center justify-center min-h-screen p-4 text-center sm:p-0">
        <div class="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg w-full">
          
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            
            <!-- Success State -->
            <div *ngIf="success" class="text-center py-8">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 class="text-lg leading-6 font-medium text-slate-900">Request Sent!</h3>
              <div class="mt-2">
                <p class="text-sm text-slate-500">
                  We have sent your request to {{clinic.name}}. They will call you shortly to confirm.
                </p>
              </div>
              <div class="mt-5">
                <button type="button" (click)="close.emit()" class="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm">
                  Close
                </button>
              </div>
            </div>

            <!-- Booking Flow -->
            <div *ngIf="!success">
              <h3 class="text-lg leading-6 font-medium text-slate-900 mb-1" id="modal-title">Book Appointment</h3>
              <p class="text-sm text-slate-500 mb-6">at {{clinic.name}}</p>

              <!-- Step 1: Loading -->
              <div *ngIf="loading" class="text-center py-8">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>

              <!-- Step 1: Date & Slot Selection or Fallback -->
              <div *ngIf="!loading && !showForm">
                 
                 <div *ngIf="availableDates.length === 0" class="text-center py-4 text-slate-500 bg-slate-50 rounded-lg mb-4">
                    <p class="text-sm">No specific time slots are available online right now.</p>
                 </div>

                 <!-- Date Tabs -->
                 <div *ngIf="availableDates.length > 0">
                     <div class="flex space-x-2 overflow-x-auto pb-2 mb-4">
                         <button *ngFor="let date of availableDates" 
                            (click)="selectedDate = date"
                            [class.bg-blue-600]="selectedDate === date"
                            [class.text-white]="selectedDate === date"
                            [class.bg-slate-100]="selectedDate !== date"
                            [class.text-slate-700]="selectedDate !== date"
                            class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors">
                            {{ date | date:'EEE, MMM d' }}
                         </button>
                     </div>

                     <!-- Time Grid -->
                     <div class="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto mb-6">
                         <button *ngFor="let slot of getSlotsForDate(selectedDate)"
                            (click)="selectSlot(slot)"
                            class="px-3 py-2 border rounded-md text-sm hover:border-blue-500 hover:text-blue-600 transition-colors bg-white text-slate-700">
                            {{ slot.time }}
                         </button>
                     </div>
                 </div>

                 <!-- General Enquiry Button -->
                 <div class="border-t pt-4">
                    <p class="text-xs text-center text-slate-500 mb-3" *ngIf="availableDates.length > 0">Can't find a suitable time?</p>
                    <button (click)="proceedGeneralEnquiry()" class="w-full text-blue-600 font-medium text-sm py-2 hover:bg-blue-50 rounded transition-colors">
                        Request callback without selecting a time
                    </button>
                 </div>
              </div>

              <!-- Step 2: Patient Details -->
              <form *ngIf="showForm" (ngSubmit)="submit()">
                
                <div *ngIf="data.slotId" class="mb-4 bg-blue-50 p-3 rounded-md flex justify-between items-center">
                    <div>
                        <span class="block text-xs text-blue-600 font-bold uppercase tracking-wide">Selected Time</span>
                        <span class="text-blue-900 font-medium">{{ selectedDate | date:'mediumDate' }} at {{ getSelectedSlotTime() }}</span>
                    </div>
                    <button type="button" (click)="resetSelection()" class="text-xs text-blue-500 hover:text-blue-700 underline">Change</button>
                </div>

                <div *ngIf="!data.slotId" class="mb-4 bg-amber-50 p-3 rounded-md flex justify-between items-center">
                    <div>
                        <span class="block text-xs text-amber-600 font-bold uppercase tracking-wide">General Request</span>
                        <span class="text-amber-900 font-medium text-sm">The clinic will schedule a time with you.</span>
                    </div>
                    <button type="button" (click)="resetSelection()" class="text-xs text-amber-600 hover:text-amber-800 underline">Back</button>
                </div>

                <div class="mb-4">
                  <label class="block text-slate-700 text-sm font-bold mb-2">Your Name</label>
                  <input [(ngModel)]="data.patientName" name="name" type="text" required class="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500">
                </div>

                <div class="mb-4">
                  <label class="block text-slate-700 text-sm font-bold mb-2">Phone Number</label>
                  <input [(ngModel)]="data.phone" name="phone" type="tel" required class="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500">
                </div>

                <div class="mb-6">
                  <label class="block text-slate-700 text-sm font-bold mb-2">Reason (Optional)</label>
                  <textarea [(ngModel)]="data.reason" name="reason" rows="3" class="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"></textarea>
                </div>

                <div *ngIf="error" class="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
                  {{ error }}
                </div>

                <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button type="submit" [disabled]="submitting" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {{ submitting ? 'Sending Request...' : 'Confirm Request' }}
                  </button>
                  <button type="button" (click)="close.emit()" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
})
export class BookingModalComponent implements OnInit {
  @Input() clinic!: Clinic;
  @Output() close = new EventEmitter<void>();

  slots: Slot[] = [];
  availableDates: string[] = [];
  selectedDate: string = '';
  showForm = false;

  data = {
    clinicId: '',
    slotId: '',
    patientName: '',
    phone: '',
    reason: ''
  };

  loading = true;
  submitting = false;
  success = false;
  error = '';

  constructor(private api: ApiService) { }

  ngOnInit() {
    this.data.clinicId = this.clinic.id;
    this.loadSlots();
  }

  loadSlots() {
    this.loading = true;
    this.api.getSlots(this.clinic.id).subscribe({
      next: (data) => {
        this.slots = data;
        const dates = new Set(data.map(s => s.date));
        this.availableDates = Array.from(dates).sort();
        if (this.availableDates.length > 0) {
          this.selectedDate = this.availableDates[0];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  getSlotsForDate(date: string) {
    return this.slots.filter(s => s.date === date);
  }

  selectSlot(slot: Slot) {
    this.data.slotId = slot.id;
    this.showForm = true;
  }

  proceedGeneralEnquiry() {
    this.data.slotId = '';
    this.showForm = true;
  }

  resetSelection() {
    this.showForm = false;
    this.data.slotId = '';
  }

  getSelectedSlotTime() {
    const slot = this.slots.find(s => s.id === this.data.slotId);
    return slot ? slot.time : '';
  }

  submit() {
    if (!this.data.patientName || !this.data.phone) {
      this.error = 'Name and Phone are required';
      return;
    }

    if (this.data.phone.length < 10) {
      this.error = 'Phone number must be at least 10 digits';
      return;
    }

    this.submitting = true;
    this.error = '';

    // If slotId is empty, we must ensure clinicId is sent.
    // It is set in ngOnInit.

    // Copy data to avoid sending empty slotId string if API expects optional/undefined?
    // API logic handles empty string check? No, Zod uuid validation will fail on empty string!
    // We need to send undefined if generic.
    const payload: any = { ...this.data };
    if (!payload.slotId) delete payload.slotId;

    this.api.bookAppointment(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.success = true;
      },
      error: (err) => {
        this.submitting = false;
        if (err.error?.error) {
          this.error = err.error.error;
        } else {
          this.error = 'Failed to submit request.';
        }
      }
    })
  }
}

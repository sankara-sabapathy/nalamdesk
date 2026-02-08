
import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataService } from '../services/api.service';
import { VitalsFormComponent } from '../visits/vitals/vitals-form.component';

@Component({
  // ... (omitted for brevity, keeping same template)
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, VitalsFormComponent],
  template: `
    <div class="h-full bg-gray-50 p-4 md:p-8 font-sans flex flex-col overflow-hidden">
      <div class="w-full">
        <!-- Header -->
        <div class="flex justify-between items-center mb-8">
           <div class="flex items-center gap-4">
             <button (click)="goBack()" class="btn btn-circle btn-ghost">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
             </button>
             <div>
               <h1 class="text-3xl font-bold text-blue-900">Patient Queue</h1>
               <p class="text-gray-600">Manage waiting list and consultations</p>
             </div>
           </div>
           
           <div class="stats shadow bg-white">
             <div class="stat place-items-center">
               <div class="stat-title">Waiting</div>
               <div class="stat-value text-blue-600">{{ queue().length }}</div>
             </div>
           </div>
        </div>

        <!-- Main Card (Flex child takes remaining height) -->
        <div class="card bg-white shadow-xl border border-gray-200 flex-1 overflow-hidden flex flex-col">
          <div class="card-body p-0 flex-1 overflow-y-auto relative">
            <div class="overflow-x-auto">
              <table class="table table-lg">
                <thead class="bg-base-200/50 text-base-content/70 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th class="min-w-[100px]">Priority</th>
                    <th class="min-w-[200px]">Patient Details</th>
                    <th class="min-w-[140px]">Check-in Time</th>
                    <th class="min-w-[120px]">Status</th>
                    <th class="text-right min-w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of queue()" 
                      class="hover:bg-base-200/50 transition-colors border-b border-base-200 last:border-0 group">
                    <td>
                      <div class="flex items-center gap-2">
                         <div class="w-2 h-12 rounded-r-md" 
                              [class.bg-error]="item.priority === 2"
                              [class.bg-base-300]="item.priority === 1"></div>
                         <div *ngIf="item.priority === 2" class="badge badge-error badge-sm animate-pulse">EMERGENCY</div>
                         <div *ngIf="item.priority === 1" class="badge badge-ghost badge-sm">Normal</div>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center gap-4">
                        <div class="avatar placeholder">
                          <div class="bg-neutral text-neutral-content rounded-full w-12">
                            <span class="text-lg">{{ item.patient_name.charAt(0) }}</span>
                          </div>
                        </div>
                        <div>
                          <div class="font-bold text-lg">{{ item.patient_name }}</div>
                          <div class="text-sm opacity-60">{{ item.age }} years • {{ item.gender }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="font-mono text-sm opacity-70">
                      <div class="flex flex-col">
                        <span>{{ item.check_in_time | date:'shortTime' }}</span>
                        <span class="text-xs text-secondary font-bold" *ngIf="item.status === 'waiting'">
                           {{ getWaitTime(item.check_in_time) }} wait
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="badge badge-lg gap-2" [ngClass]="{
                        'badge-primary': item.status === 'in-consult',
                        'badge-ghost': item.status === 'waiting'
                      }">
                        <div class="w-2 h-2 rounded-full bg-current"></div>
                        {{ item.status | titlecase }}
                      </div>
                    </td>
                    <td class="text-right">
                      <div class="join opacity-0 group-hover:opacity-100 transition-opacity">
                        <button *ngIf="item.status === 'waiting'" 
                                (click)="openVitals(item.patient_id)"
                                class="btn btn-secondary btn-sm join-item">
                          Vitals
                        </button>
                        <button *ngIf="item.status === 'waiting'" 
                                (click)="updateStatus(item.id, 'in-consult')"
                                class="btn btn-primary btn-sm join-item">
                          Start Consult
                        </button>
                        <button *ngIf="item.status === 'in-consult'" 
                                (click)="updateStatus(item.id, 'completed')" 
                                class="btn btn-success btn-sm join-item">
                          Complete
                        </button>
                        <button (click)="remove(item.id)" class="btn btn-error btn-outline btn-sm join-item">
                          Remove
                        </button>
                      </div>
                      <!-- Mobile fallback or always visible action if hover isn't reliable -->
                      <button *ngIf="item.status === 'waiting'" (click)="updateStatus(item.id, 'in-consult')" class="btn btn-circle btn-sm btn-primary md:hidden">
                        ▶
                      </button>
                    </td>
                  </tr>
                  
                  <!-- Empty State -->
                  <tr *ngIf="queue().length === 0">
                    <td colspan="5" class="py-20 text-center">
                       <div class="flex flex-col items-center gap-4 opacity-50">
                         <svg xmlns="http://www.w3.org/2000/svg" class="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                         <h3 class="text-xl font-bold">All Clear!</h3>
                         <p>No patients currently in the queue.</p>
                       </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Vitals Modal -->
      <app-vitals-form *ngIf="showVitalsModal" 
        (close)="closeVitalsModal()" 
        (save)="onVitalsSaved($event)"
        [patientId]="selectedPatientIdForVitals">
      </app-vitals-form>
    </div>
  `
})
export class QueueComponent implements OnInit, OnDestroy {
  queue = signal<any[]>([]);
  refreshIntervalId: any;

  constructor(
    private router: Router,
    private dataService: DataService
  ) { }

  ngOnInit() {
    this.refreshQueue();
    // Poll every 30 seconds
    this.refreshIntervalId = setInterval(() => this.refreshQueue(), 30000);
  }

  ngOnDestroy() {
    if (this.refreshIntervalId) clearInterval(this.refreshIntervalId);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async refreshQueue() {
    try {
      const data = await this.dataService.invoke<any>('getQueue');
      this.queue.set(data);
    } catch (e) {
      console.error('Failed to load queue', e);
    }
  }

  async updateStatus(id: number, status: string) {
    try {
      const item = this.queue().find(x => x.id === id);
      await this.dataService.invoke<any>('updateQueueStatus', { id, status });
      this.refreshQueue();

      if (status === 'in-consult' && item) {
        this.router.navigate(['/visit', item.patient_id], {
          state: { isConsulting: true, patientName: item.patient_name }
        });
      }
    } catch (e) {
      console.error('Update failed', e);
      alert('Failed to update status');
    }
  }

  async remove(id: number) {
    if (confirm('Remove from queue?')) {
      try {
        await this.dataService.invoke<any>('removeFromQueue', id);
        this.refreshQueue();
      } catch (e) {
        console.error('Remove failed', e);
        alert('Failed to remove from queue');
      }
    }
  }

  getWaitTime(dateStr: string): string {
    if (!dateStr) return '';
    // Normalize SQL date space to T for reliable parsing
    const normalized = dateStr.replace(' ', 'T');
    const start = new Date(normalized + 'Z').getTime();
    const now = new Date().getTime();

    if (isNaN(start)) return '';

    // If date is future (clock skew), return 0m
    if (start > now) return '0m';

    const diff = Math.floor((now - start) / 60000); // minutes
    if (diff < 60) return `${diff}m`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  }

  // Vitals Logic
  showVitalsModal = false;
  selectedPatientIdForVitals: number | null = null;

  openVitals(patientId: number) {
    this.selectedPatientIdForVitals = patientId;
    this.showVitalsModal = true;
  }

  closeVitalsModal() {
    this.showVitalsModal = false;
    this.selectedPatientIdForVitals = null;
  }

  onVitalsSaved(data: any) {
    this.closeVitalsModal();
    // Optional: Show success toast
  }
}

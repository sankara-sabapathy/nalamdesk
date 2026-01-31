import { Component, OnInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataService } from '../../services/api.service';

@Component({
  // ... template omitted ...
  selector: 'app-visit-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6 bg-gray-100 min-h-screen">
      <div class="max-w-7xl mx-auto">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Recent Visits</h1>
            <a routerLink="/patients" class="text-blue-600 hover:text-blue-800 font-medium">Find Patient →</a>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full">
            <thead class="bg-gray-50 text-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Patient</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Diagnosis</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Doctor</th>
                <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr *ngFor="let visit of visits" class="hover:bg-gray-50 cursor-pointer" (click)="goToVisit(visit)">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ visit.date | date:'medium' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                  {{ visit.patient_name }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-700 truncate max-w-xs">{{ visit.diagnosis }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ visit.doctor_name || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹{{ visit.amount_paid }}</td>
              </tr>
              <tr *ngIf="visits.length === 0">
                <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                  No visits found. Go to <a routerLink="/patients" class="text-blue-600 underline">Patients</a> to add a visit.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class VisitListComponent implements OnInit {
  visits: any[] = [];

  private dataService: DataService = inject(DataService);

  constructor(
    private ngZone: NgZone,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadVisits();
  }

  async loadVisits() {
    try {
      const data = await this.dataService.invoke<any>('getAllVisits', 50);
      this.ngZone.run(() => {
        this.visits = data;
      });
    } catch (e) {
      console.error('Failed to load visits', e);
    }
  }


  goToVisit(visit: any) {
    this.router.navigate(['/visit', visit.patient_id]);
  }
}

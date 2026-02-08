import { Component, OnInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataService } from '../../services/api.service';
import { SharedTableComponent } from '../../shared/components/table/table.component';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-visit-list',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedTableComponent],
  template: `
    <div class="h-full bg-gray-100 p-4 md:p-6 flex flex-col overflow-hidden">
      <div class="w-full">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-800">Recent Visits</h1>
            <a routerLink="/patients" class="text-blue-600 hover:text-blue-800 font-medium">Find Patient →</a>
        </div>
        
        <div class="flex-1 h-[calc(100vh-150px)]">
           <app-shared-table
              [rowData]="visits"
              [columnDefs]="colDefs"
              [loading]="loading"
              [multiSelect]="true"
              (selectionChanged)="selectedVisits = $event"
              (rowClick)="onRowClick($event)"
           >
              <div toolbar-left>
                  <button *ngIf="selectedVisits.length > 0" (click)="deleteSelectedVisits()" 
                          class="bg-red-50 text-red-600 px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 hover:bg-red-100 flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Delete ({{ selectedVisits.length }})
                  </button>
              </div>
           </app-shared-table>
        </div>
      </div>
    </div>
  `
})
export class VisitListComponent implements OnInit {
  visits: any[] = [];
  loading = false;
  selectedVisits: any[] = [];

  colDefs: ColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      flex: 1,
      minWidth: 160,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleString();
      }
    },
    {
      field: 'patient_name',
      headerName: 'Patient',
      flex: 1.5,
      minWidth: 180,
      cellClass: 'font-medium text-blue-600'
    },
    { field: 'diagnosis', headerName: 'Diagnosis', flex: 2, minWidth: 250, wrapText: true, autoHeight: true },
    { field: 'doctor_name', headerName: 'Doctor', flex: 1, minWidth: 150 },
    {
      field: 'amount_paid',
      headerName: 'Amount',
      flex: 0.8,
      minWidth: 120,
      type: 'rightAligned',
      valueFormatter: (params) => params.value ? '₹' + params.value : '₹0'
    }
  ];

  private dataService: DataService = inject(DataService);

  constructor(
    private ngZone: NgZone,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadVisits();
  }

  async loadVisits() {
    this.loading = true;
    try {
      const data = await this.dataService.invoke<any>('getAllVisits', 100);
      this.ngZone.run(() => {
        this.visits = data;
        this.loading = false;
      });
    } catch (e) {
      console.error('Failed to load visits', e);
      this.loading = false;
    }
  }

  async deleteSelectedVisits() {
    if (this.selectedVisits.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${this.selectedVisits.length} visits? This cannot be undone.`)) return;

    try {
      for (const v of this.selectedVisits) {
        await this.dataService.invoke('deleteVisit', v.id);
      }
      this.ngZone.run(() => {
        this.selectedVisits = [];
        this.loadVisits();
      });
    } catch (e) {
      console.error(e);
      alert('Error deleting visits. Check console.');
    }
  }

  onRowClick(data: any) {
    this.goToVisit(data);
  }

  goToVisit(visit: any) {
    this.router.navigate(['/visit', visit.patient_id]);
  }
}

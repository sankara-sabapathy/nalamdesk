
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/api.service';

@Component({
  // ... (omitted)
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-between">
          Audit Logs
          <button class="btn btn-sm btn-ghost" (click)="loadLogs()">
             Refresh
          </button>
        </h2>
        
        <div class="overflow-x-auto h-96">
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Table</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs()">
                <td class="whitespace-nowrap">{{ log.timestamp | date:'medium' }}</td>
                <td>
                  <span class="badge badge-sm" [ngClass]="{
                    'badge-success': log.action === 'INSERT',
                    'badge-warning': log.action === 'UPDATE',
                    'badge-error': log.action === 'DELETE'
                  }">{{ log.action }}</span>
                </td>
                <td>{{ log.table_name }}</td>
                <td class="w-full">{{ log.details }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AuditLogComponent implements OnInit {
  logs = signal<any[]>([]);
  private dataService: DataService = inject(DataService);

  ngOnInit() {
    this.loadLogs();
  }

  async loadLogs() {
    try {
      const data = await this.dataService.invoke<any>('getAuditLogs', 100);
      this.logs.set(data);
    } catch (e) {
      console.error('Failed to load logs', e);
    }
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-action-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex justify-end gap-3 h-full items-center">
      <button (click)="onEdit()" class="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
        ✏️
      </button>
      <button *ngIf="canDelete" (click)="onDelete()" class="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
        🗑️
      </button>
      <span *ngIf="!canDelete" class="text-gray-200 cursor-not-allowed" title="Cannot delete this user">🗑️</span>
    </div>
  `,
  styles: []
})
export class ActionRendererComponent implements ICellRendererAngularComp {
  params: any;

  agInit(params: ICellRendererParams): void {
    this.params = params;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    return true;
  }

  get canDelete(): boolean {
    if (this.params.canDelete) {
      return this.params.canDelete(this.params.data);
    }
    return true;
  }

  onEdit() {
    if (this.params.onEdit) {
      this.params.onEdit(this.params.data);
    }
  }

  onDelete() {
    if (this.params.onDelete) {
      this.params.onDelete(this.params.data);
    }
  }
}


import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
    selector: 'app-action-renderer',
    standalone: true,
    template: `
    <div class="flex justify-end gap-3 h-full items-center">
      <button (click)="onEdit()" class="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
        ✏️
      </button>
      <button (click)="onDelete()" class="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
        🗑️
      </button>
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


import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-prescription',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="card bg-base-100 border border-base-200">
      <div class="card-body p-4">
        <h3 class="card-title text-sm">Prescription</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2" *ngFor="let item of items(); let i = index">
          <div class="form-control md:col-span-2">
            <input type="text" placeholder="Medicine Name" 
                   [(ngModel)]="item.medicine" 
                   class="input input-bordered input-sm w-full" />
          </div>
          <div class="form-control">
            <select [(ngModel)]="item.frequency" class="select select-bordered select-sm w-full">
              <option value="1-0-1">1-0-1</option>
              <option value="1-1-1">1-1-1</option>
              <option value="1-0-0">1-0-0</option>
              <option value="0-0-1">0-0-1</option>
              <option value="SOS">SOS</option>
            </select>
          </div>
          <div class="form-control">
            <input type="text" placeholder="Duration (e.g. 5 days)" 
                   [(ngModel)]="item.duration" 
                   class="input input-bordered input-sm w-full" />
          </div>
          <div class="flex gap-2">
             <select [(ngModel)]="item.instruction" class="select select-bordered select-sm w-full">
              <option value="After Food">After Food</option>
              <option value="Before Food">Before Food</option>
            </select>
            <button class="btn btn-sm btn-square btn-ghost text-error" (click)="remove(i)">
              ✕
            </button>
          </div>
        </div>
        
        <div class="flex justify-between mt-2">
           <button class="btn btn-sm btn-ghost gap-2" (click)="add()">
            + Add Medicine
          </button>
        </div>
      </div>
    </div>
  `
})
export class PrescriptionComponent {
    @Input() set initialData(value: any[]) {
        if (value && value.length > 0) this.items.set(value);
    }
    @Output() changed = new EventEmitter<any[]>();

    items = signal<any[]>([
        { medicine: '', frequency: '1-0-1', duration: '3 days', instruction: 'After Food' }
    ]);

    add() {
        this.items.update(list => [...list, { medicine: '', frequency: '1-0-1', duration: '3 days', instruction: 'After Food' }]);
        this.emitChange();
    }

    remove(index: number) {
        this.items.update(list => list.filter((_, i) => i !== index));
        this.emitChange();
    }

    emitChange() {
        this.changed.emit(this.items());
    }
}

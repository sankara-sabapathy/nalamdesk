import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-prescription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card bg-base-100 border border-base-200">
      <div class="card-body p-3 md:p-4">
        <h3 class="card-title text-sm mb-2">Prescription</h3>
        
        <!-- Header (Desktop Only) -->
        <!-- Optional: Add headers for columns on desktop for clarity, skipping for now to keep simple -->

        <div class="grid grid-cols-12 gap-2 mb-3 md:mb-2 items-start md:items-center bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-lg md:rounded-none relative border md:border-none border-gray-100" 
             *ngFor="let item of items(); let i = index">
          
          <!-- Mobile Delete (Absolute Top Right) -->
          <button class="md:hidden absolute top-1 right-1 btn btn-xs btn-ghost text-error" (click)="remove(i)">
              ✕
          </button>

          <!-- 1. Medicine (Full Width on Mobile) -->
          <div class="col-span-12 md:col-span-3">
            <span class="text-xs text-gray-500 md:hidden font-bold">Medicine</span>
            <input type="text" placeholder="Medicine Name" 
                   [(ngModel)]="item.medicine" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full font-medium" />
          </div>

          <!-- 2. Form (1/3 Mobile) -->
          <div class="col-span-4 md:col-span-1">
             <span class="text-xs text-gray-500 md:hidden">Form</span>
             <select [(ngModel)]="item.form" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
               <option value="Tab">Tab</option>
               <option value="Cap">Cap</option>
               <option value="Syr">Syr</option>
               <option value="Inj">Inj</option>
               <option value="Oint">Oint</option>
               <option value="Drop">Drop</option>
             </select>
          </div>

          <!-- 3. Dosage (1/3 Mobile) -->
           <div class="col-span-4 md:col-span-1">
            <span class="text-xs text-gray-500 md:hidden">Dose</span>
            <input type="text" placeholder="500mg" 
                   [(ngModel)]="item.dosage" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full px-1" />
          </div>

          <!-- 4. Route (1/3 Mobile) -->
          <div class="col-span-4 md:col-span-1">
             <span class="text-xs text-gray-500 md:hidden">Route</span>
             <select [(ngModel)]="item.route" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
               <option value="Oral">Oral</option>
               <option value="IV">IV</option>
               <option value="IM">IM</option>
               <option value="SC">SC</option>
               <option value="Topical">Topical</option>
             </select>
          </div>

          <!-- 5. Frequency (1/2 Mobile) -->
          <div class="col-span-6 md:col-span-2">
            <span class="text-xs text-gray-500 md:hidden">Frequency</span>
            <select [(ngModel)]="item.frequency" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full">
              <option value="1-0-1">1-0-1 (BID)</option>
              <option value="1-1-1">1-1-1 (TID)</option>
              <option value="1-0-0">1-0-0 (OD)</option>
              <option value="0-0-1">0-0-1 (HS)</option>
              <option value="0-1-0">0-1-0 (Afternoon)</option>
              <option value="SOS">SOS</option>
              <option value="STAT">STAT</option>
            </select>
          </div>

          <!-- 6. Duration (1/2 Mobile) -->
          <div class="col-span-6 md:col-span-2">
            <span class="text-xs text-gray-500 md:hidden">Duration</span>
            <input type="text" placeholder="3 days" 
                   [(ngModel)]="item.duration" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full" />
          </div>

          <!-- 7. Instruction (Full Mobile) + Desktop Delete -->
          <div class="col-span-12 md:col-span-2 flex gap-1 items-end">
            <div class="w-full">
                <span class="text-xs text-gray-500 md:hidden">Instruction</span>
                <select [(ngModel)]="item.instruction" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
                    <option value="After Food">After Food</option>
                    <option value="Before Food">Before Food</option>
                    <option value="With Food">With Food</option>
                    <option value="Empty Stomach">Empty Stomach</option>
                </select>
            </div>
            
            <button class="hidden md:flex btn btn-sm btn-square btn-ghost text-error" (click)="remove(i)">
              ✕
            </button>
          </div>
        </div>
        
        <div class="flex justify-between mt-2">
           <button class="btn btn-sm btn-ghost gap-2 text-blue-600 hover:bg-blue-50" (click)="add()">
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
    { medicine: '', form: 'Tab', dosage: '', route: 'Oral', frequency: '1-0-1', duration: '3 days', instruction: 'After Food' }
  ]);

  add() {
    this.items.update(list => [...list, { medicine: '', form: 'Tab', dosage: '', route: 'Oral', frequency: '1-0-1', duration: '3 days', instruction: 'After Food' }]);
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


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
        
        <div class="grid grid-cols-12 gap-2 mb-2 items-center" *ngFor="let item of items(); let i = index">
          
          <!-- Medicine -->
          <div class="col-span-3">
            <input type="text" placeholder="Medicine Name" 
                   [(ngModel)]="item.medicine" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full" />
          </div>

          <!-- Form (Tab/Syr) -->
          <div class="col-span-1">
             <select [(ngModel)]="item.form" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
               <option value="Tab">Tab</option>
               <option value="Cap">Cap</option>
               <option value="Syr">Syr</option>
               <option value="Inj">Inj</option>
               <option value="Oint">Oint</option>
               <option value="Drop">Drop</option>
             </select>
          </div>

          <!-- Dosage -->
           <div class="col-span-1">
            <input type="text" placeholder="Dose" 
                   [(ngModel)]="item.dosage" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full px-1" />
          </div>

          <!-- Route -->
          <div class="col-span-1">
             <select [(ngModel)]="item.route" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
               <option value="Oral">Oral</option>
               <option value="IV">IV</option>
               <option value="IM">IM</option>
               <option value="SC">SC</option>
               <option value="Topical">Topical</option>
             </select>
          </div>

          <!-- Frequency -->
          <div class="col-span-2">
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

          <!-- Duration -->
          <div class="col-span-2">
            <input type="text" placeholder="Dur" 
                   [(ngModel)]="item.duration" (ngModelChange)="emitChange()"
                   class="input input-bordered input-sm w-full" />
          </div>

          <!-- Instruction & Remove -->
          <div class="col-span-2 flex gap-1">
             <select [(ngModel)]="item.instruction" (ngModelChange)="emitChange()" class="select select-bordered select-sm w-full px-1">
              <option value="After Food">After Food</option>
              <option value="Before Food">Before Food</option>
              <option value="With Food">With Food</option>
              <option value="Empty Stomach">Empty Stomach</option>
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

import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/api.service';

@Component({
    selector: 'app-catalog-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="h-full overflow-y-auto p-4 md:p-8">
      <h2 class="text-2xl font-bold text-gray-800 mb-2">Diagnosis &amp; medicine catalogs</h2>
      <p class="text-sm text-gray-500 mb-6">Clinic-local lists for Plan &amp; Rx. Soft-retire hides a term from typeahead; saved visits keep their original text.</p>

      <div class="flex gap-2 mb-4">
        <button type="button" class="btn btn-sm" [class.btn-primary]="section === 'conditions'" (click)="section = 'conditions'">Conditions</button>
        <button type="button" class="btn btn-sm" [class.btn-primary]="section === 'medicines'" (click)="section = 'medicines'">Medicines</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" class="checkbox checkbox-xs" [(ngModel)]="includeRetired" (ngModelChange)="reload()" />
          Show retired
        </label>
      </div>

      <p *ngIf="message" class="text-sm mb-3" [class.text-red-600]="!success" [class.text-green-700]="success">{{ message }}</p>

      <div *ngIf="section === 'conditions'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white border rounded-lg p-4">
          <h3 class="font-semibold mb-3">Conditions</h3>
          <div class="flex gap-2 mb-3">
            <input class="input input-bordered input-sm flex-1" [(ngModel)]="newCondition" placeholder="Add condition" />
            <button class="btn btn-sm btn-primary" type="button" (click)="addCondition()">Add</button>
          </div>
          <div *ngFor="let row of conditions" class="flex items-center gap-2 py-2 border-b border-gray-100">
            <input class="input input-bordered input-xs flex-1" [(ngModel)]="row.name" [disabled]="row.active === 0" />
            <button class="btn btn-xs" type="button" [disabled]="row.active === 0" (click)="saveCondition(row)">Save</button>
            <button class="btn btn-xs btn-ghost text-error" type="button" [disabled]="row.active === 0" (click)="retire('retireCondition', row)">Retire</button>
            <button class="btn btn-xs btn-ghost" type="button" (click)="selectCondition(row)">Presets</button>
          </div>
        </div>
        <div class="bg-white border rounded-lg p-4" *ngIf="selectedCondition">
          <h3 class="font-semibold mb-3">Presets for {{ selectedCondition.name }}</h3>
          <div *ngFor="let line of presetLines; let i = index" class="grid grid-cols-12 gap-1 mb-2">
            <select class="select select-bordered select-xs col-span-5" [(ngModel)]="line.medicine_id" (ngModelChange)="onPresetMedicine(i)">
              <option [ngValue]="null">Medicine</option>
              <option *ngFor="let med of medicines" [ngValue]="med.id">{{ med.name }}</option>
            </select>
            <input class="input input-bordered input-xs col-span-3" [(ngModel)]="line.dosage" placeholder="Dose" />
            <input class="input input-bordered input-xs col-span-3" [(ngModel)]="line.duration" placeholder="Duration" />
            <button class="btn btn-xs btn-ghost text-error col-span-1" type="button" (click)="removePreset(i)">✕</button>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-sm" type="button" (click)="addPresetLine()">+ Line</button>
            <button class="btn btn-sm btn-primary" type="button" (click)="savePresets()">Save presets</button>
          </div>
        </div>
      </div>

      <div *ngIf="section === 'medicines'" class="bg-white border rounded-lg p-4">
        <h3 class="font-semibold mb-3">Medicines</h3>
        <div class="flex gap-2 mb-3">
          <input class="input input-bordered input-sm flex-1" [(ngModel)]="newMedicine" placeholder="Add medicine" />
          <button class="btn btn-sm btn-primary" type="button" (click)="addMedicine()">Add</button>
        </div>
        <div *ngFor="let row of medicines" class="grid grid-cols-12 gap-2 py-2 border-b border-gray-100 items-center">
          <input class="input input-bordered input-xs col-span-4" [(ngModel)]="row.name" [disabled]="row.active === 0" />
          <input class="input input-bordered input-xs col-span-2" [(ngModel)]="row.dosage" [disabled]="row.active === 0" placeholder="Dose" />
          <input class="input input-bordered input-xs col-span-2" [(ngModel)]="row.frequency" [disabled]="row.active === 0" placeholder="Freq" />
          <input class="input input-bordered input-xs col-span-2" [(ngModel)]="row.duration" [disabled]="row.active === 0" placeholder="Days" />
          <button class="btn btn-xs col-span-1" type="button" [disabled]="row.active === 0" (click)="saveMedicine(row)">Save</button>
          <button class="btn btn-xs btn-ghost text-error col-span-1" type="button" [disabled]="row.active === 0" (click)="retire('retireMedicine', row)">Retire</button>
        </div>
      </div>
    </div>
  `
})
export class CatalogSettingsComponent implements OnInit {
    section: 'conditions' | 'medicines' = 'conditions';
    includeRetired = false;
    conditions: any[] = [];
    medicines: any[] = [];
    selectedCondition: any = null;
    presetLines: any[] = [];
    newCondition = '';
    newMedicine = '';
    message = '';
    success = false;

    constructor(private readonly data: DataService, private readonly ngZone: NgZone) { }

    ngOnInit(): void {
        this.reload().catch(() => undefined);
    }

    async reload(): Promise<void> {
        const [conditions, medicines] = await Promise.all([
            this.data.invoke('listConditions', this.includeRetired),
            this.data.invoke('listMedicines', this.includeRetired)
        ]);
        this.ngZone.run(() => {
            this.conditions = conditions || [];
            this.medicines = medicines || [];
        });
    }

    async addCondition(): Promise<void> {
        await this.create('createCondition', { name: this.newCondition }, () => { this.newCondition = ''; });
    }

    async addMedicine(): Promise<void> {
        await this.create('createMedicine', { name: this.newMedicine }, () => { this.newMedicine = ''; });
    }

    async saveCondition(row: any): Promise<void> {
        await this.write('updateCondition', { id: row.id, name: row.name });
    }

    async saveMedicine(row: any): Promise<void> {
        await this.write('updateMedicine', row);
    }

    async retire(method: 'retireCondition' | 'retireMedicine', row: any): Promise<void> {
        await this.write(method, row.id);
        if (method === 'retireCondition' && this.selectedCondition?.id === row.id) {
            this.selectedCondition = null;
        }
    }

    async selectCondition(row: any): Promise<void> {
        const lines = await this.data.invoke('getConditionMedPresets', row.id);
        this.ngZone.run(() => {
            this.selectedCondition = row;
            this.presetLines = (lines || []).map((line: any) => ({ ...line }));
        });
    }

    addPresetLine(): void {
        this.presetLines = [...this.presetLines, {
            medicine_id: null, medicine: '', form: 'Tab', dosage: '', route: 'Oral',
            frequency: '1-0-1', duration: '3 days', instruction: 'After Food'
        }];
    }

    removePreset(index: number): void {
        this.presetLines = this.presetLines.filter((_, i) => i !== index);
    }

    onPresetMedicine(index: number): void {
        const line = this.presetLines[index];
        const med = this.medicines.find((item) => item.id === line.medicine_id);
        if (!med) return;
        this.presetLines[index] = {
            ...line,
            medicine: med.name,
            form: med.form || line.form,
            dosage: med.dosage || line.dosage,
            route: med.route || line.route,
            frequency: med.frequency || line.frequency,
            duration: med.duration || line.duration,
            instruction: med.instruction || line.instruction
        };
    }

    async savePresets(): Promise<void> {
        if (!this.selectedCondition) return;
        await this.write('replaceConditionMedPresets', {
            conditionId: this.selectedCondition.id,
            lines: this.presetLines
        });
    }

    private async create(method: string, payload: { name: string }, reset: () => void): Promise<void> {
        try {
            await this.data.invoke(method, payload);
            reset();
            this.flash(true, 'Saved.');
            await this.reload();
        } catch (error) {
            this.flash(false, this.catalogError(error));
        }
    }

    private async write(method: string, payload: unknown): Promise<void> {
        try {
            await this.data.invoke(method, payload);
            this.flash(true, 'Saved.');
            await this.reload();
        } catch (error) {
            this.flash(false, this.catalogError(error));
        }
    }

    private flash(ok: boolean, text: string): void {
        this.ngZone.run(() => {
            this.success = ok;
            this.message = text;
        });
    }

    private catalogError(error: unknown): string {
        const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : '');
        if (/NAME_REQUIRED/i.test(message)) return 'Name is required.';
        if (/DUPLICATE_ACTIVE_NAME/i.test(message)) return 'That active name already exists.';
        return 'Could not save catalog changes.';
    }
}

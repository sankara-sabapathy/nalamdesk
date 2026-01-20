import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-screen bg-gray-100 p-8 overflow-y-auto">
      <div class="max-w-4xl mx-auto pb-16">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">Settings & Resilience</h1>
        
        <!-- Tabs -->
        <div class="flex space-x-4 mb-6 border-b">
            <button class="pb-2 px-4 font-medium" [class.border-b-2]="activeTab === 'general'" [class.border-blue-500]="activeTab === 'general'" [class.text-blue-600]="activeTab === 'general'" (click)="activeTab = 'general'">General</button>
            <button class="pb-2 px-4 font-medium" [class.border-b-2]="activeTab === 'doctors'" [class.border-blue-500]="activeTab === 'doctors'" [class.text-blue-600]="activeTab === 'doctors'" (click)="activeTab = 'doctors'">Doctors Management</button>
        </div>

        <div *ngIf="activeTab === 'general'">
            <!-- Clinic Details -->
            <div class="bg-white p-6 rounded-lg shadow-md mb-6">
                <h2 class="text-xl font-semibold mb-4 text-gray-700">Clinic Details</h2>
                <form (ngSubmit)="saveSettings()">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                        <input [(ngModel)]="settings.clinic_name" name="clinic_name" class="w-full border p-2 rounded">
                    </div>
                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Save Details</button>
                    <span *ngIf="settingsSaved" class="text-green-600 ml-4 text-sm">Saved successfully!</span>
                </form>
            </div>

            <!-- Google Drive Connection -->
            <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-xl font-semibold mb-4 text-blue-600">Cloud Connection</h2>
            <div class="flex items-center justify-between">
                <p class="text-gray-600">Link your Google Drive to enable secure off-site backups.</p>
                <button (click)="connectDrive()" [disabled]="isLoading" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                {{ isLoading ? 'Connecting...' : 'Connect Google Drive' }}
                </button>
            </div>
            <p *ngIf="message" class="mt-2 text-sm" [ngClass]="{'text-green-600': success, 'text-red-500': !success}">
                {{ message }}
            </p>
            </div>

            <!-- Backup & Restore -->
            <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-xl font-semibold mb-4 text-green-600">Backup & Restore</h2>
            
            <div class="mb-6 pb-6 border-b">
                <h3 class="font-bold text-gray-700 mb-2">Immediate Backup</h3>
                <p class="text-sm text-gray-500 mb-3">Upload a snapshot of your current database to Google Drive.</p>
                <button (click)="backupNow()" [disabled]="isBackupLoading" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
                {{ isBackupLoading ? 'Uploading...' : 'Backup Now' }}
                </button>
            </div>

            <div>
                <h3 class="font-bold text-gray-700 mb-4">Restore from Cloud</h3>
                <button (click)="listBackups()" class="text-blue-600 hover:underline mb-4 text-sm">Refresh List</button>
                
                <div *ngIf="backups.length > 0; else noBackups" class="space-y-2">
                <div *ngFor="let file of backups" class="flex items-center justify-between p-3 bg-gray-50 rounded border">
                    <div>
                    <p class="font-medium text-gray-800">{{ file.name }}</p>
                    <p class="text-xs text-gray-500">{{ file.createdTime | date:'medium' }}</p>
                    </div>
                    <button (click)="restore(file.id)" class="text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-50 text-sm">
                    Restore
                    </button>
                </div>
                </div>
                <ng-template #noBackups>
                <p class="text-gray-500 italic text-sm">No backups found. Connect Drive and create a backup.</p>
                </ng-template>
            </div>
            </div>
        </div>

        <div *ngIf="activeTab === 'doctors'">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Doctors</h2>
                <button (click)="editDoctor({})" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">+ Add Doctor</button>
            </div>

            <div class="grid gap-4">
                <div *ngFor="let doc of doctors" class="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-lg">{{ doc.name }}</h3>
                        <p class="text-sm text-gray-600">{{ doc.specialty }} • {{ doc.license_number }}</p>
                    </div>
                    <div>
                        <button (click)="editDoctor(doc)" class="text-blue-600 hover:underline mr-4">Edit</button>
                        <button (click)="deleteDoctor(doc.id)" class="text-red-600 hover:underline">Delete</button>
                    </div>
                </div>
                <p *ngIf="doctors.length === 0" class="text-gray-500">No doctors added yet.</p>
            </div>

            <!-- Edit Modal (Simple Inline for now) -->
            <div *ngIf="editingDoctor" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-xl font-bold mb-4">{{ editingDoctor.id ? 'Edit Doctor' : 'Add Doctor' }}</h3>
                    <div class="space-y-4">
                        <input [(ngModel)]="editingDoctor.name" placeholder="Doctor Name" class="w-full border p-2 rounded">
                        <input [(ngModel)]="editingDoctor.specialty" placeholder="Specialty (e.g. General Physician)" class="w-full border p-2 rounded">
                        <input [(ngModel)]="editingDoctor.license_number" placeholder="License Number" class="w-full border p-2 rounded">
                    </div>
                    <div class="mt-6 flex justify-end gap-2">
                        <button (click)="editingDoctor = null" class="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                        <button (click)="saveDoctor()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  `,
  styles: []
})
export class SettingsComponent implements OnInit {
  activeTab: 'general' | 'doctors' = 'general';

  // General
  isLoading = false;
  isBackupLoading = false;
  message = '';
  success = false;
  backups: any[] = [];
  settings = { clinic_name: '' };
  settingsSaved = false;

  // Doctors
  doctors: any[] = [];
  editingDoctor: any = null;

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    this.loadSettings();
    this.listBackups();
    this.loadDoctors();

    // Listen for updates
    if (window.electron.updater) {
      window.electron.updater.onUpdateAvailable(() => {
        this.ngZone.run(() => this.updateStatus = 'available');
      });
      window.electron.updater.onUpdateDownloaded(() => {
        this.ngZone.run(() => this.updateStatus = 'downloaded');
      });
      window.electron.updater.onDownloadProgress((progress: any) => {
        this.ngZone.run(() => this.downloadProgress = Math.round(progress.percent));
      });
      window.electron.updater.onUpdateError((err: any) => {
        this.ngZone.run(() => {
          this.updateStatus = 'error';
          this.errorMessage = err.message || 'Unknown error';
        });
      });
    }
  }

  async loadSettings() {
    try {
      const s = await window.electron.db.getSettings();
      this.ngZone.run(() => {
        if (s) {
          this.settings.clinic_name = s.clinic_name || '';
        }
      });
    } catch (e) { console.error(e); }
  }

  async saveSettings() {
    try {
      await window.electron.db.saveSettings(this.settings);
      this.ngZone.run(() => {
        this.settingsSaved = true;
        setTimeout(() => this.settingsSaved = false, 3000);
      });
    } catch (e) { console.error(e); }
  }

  // Drive methods
  async connectDrive() {
    this.isLoading = true;
    try {
      const result = await window.electron.drive.authenticate();
      this.ngZone.run(() => {
        this.isLoading = false;
        if (result) {
          this.success = true;
          this.message = 'Connected';
          this.listBackups();
        } else {
          this.success = false;
          this.message = 'Failed';
        }
      });
    } catch (e) {
      this.ngZone.run(() => { this.isLoading = false; this.message = 'Error'; });
    }
  }

  async backupNow() {
    this.isBackupLoading = true;
    try {
      const result = await window.electron.drive.backup();
      this.ngZone.run(() => {
        this.isBackupLoading = false;
        if (result.success) { alert('Backup Successful!'); this.listBackups(); }
        else { alert('Backup Failed: ' + result.error); }
      });
    } catch (e) {
      this.ngZone.run(() => { this.isBackupLoading = false; alert('Error'); });
    }
  }

  async listBackups() {
    try {
      const files = await window.electron.drive.listBackups();
      this.ngZone.run(() => { this.backups = files; });
    } catch (e) { console.error(e); }
  }

  async restore(fileId: string) {
    if (!confirm('Warning: Overwrite data?')) return;
    try {
      const result = await window.electron.drive.restore(fileId);
      if (result.success) alert('Restore Complete. Restart App.');
    } catch (e) { alert('Error'); }
  }

  // Doctor Methods
  async loadDoctors() {
    try {
      const docs = await window.electron.db.getDoctors();
      this.ngZone.run(() => { this.doctors = docs; });
    } catch (e) { console.error(e); }
  }

  editDoctor(doc: any) {
    this.editingDoctor = { ...doc };
  }

  async saveDoctor() {
    if (!this.editingDoctor.name) return;
    try {
      await window.electron.db.saveDoctor(this.editingDoctor);
      this.ngZone.run(() => {
        this.editingDoctor = null;
        this.loadDoctors();
      });
    } catch (e) { console.error(e); }
  }

  async deleteDoctor(id: number) {
    if (!confirm('Delete this doctor?')) return;
    try {
      await window.electron.db.deleteDoctor(id);
      this.ngZone.run(() => { this.loadDoctors(); });
    } catch (e) { console.error(e); }
  }

  // Updater
  updateStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'uptodate' | 'error' = 'idle';
  downloadProgress = 0;
  errorMessage = '';
  appVersion = '0.0.0';

  checkForUpdates() {
    this.updateStatus = 'checking';
    this.errorMessage = '';
    window.electron.updater.checkForUpdates().then((update: any) => {
      this.ngZone.run(() => {
        if (!update) {
          this.updateStatus = 'uptodate';
        }
      });
    }).catch((err: any) => {
      this.ngZone.run(() => {
        this.updateStatus = 'error';
        this.errorMessage = err.message;
      });
    });
  }

  quitAndInstall() {
    window.electron.updater.quitAndInstall();
  }
}

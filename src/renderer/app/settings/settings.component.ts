import { Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

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
            <button class="pb-2 px-4 font-medium" [class.border-b-2]="activeTab === 'general'" [class.border-primary]="activeTab === 'general'" [class.text-primary]="activeTab === 'general'" (click)="activeTab = 'general'">General</button>
            <button *ngIf="currentUser?.role === 'admin'" class="pb-2 px-4 font-medium" [class.border-b-2]="activeTab === 'users'" [class.border-primary]="activeTab === 'users'" [class.text-primary]="activeTab === 'users'" (click)="activeTab = 'users'">Users</button>
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
                    <button type="submit" class="btn btn-primary">Save Details</button>
                    <span *ngIf="settingsSaved" class="text-green-600 ml-4 text-sm">Saved successfully!</span>
                </form>
            </div>

            <!-- Google Drive Connection -->
            <div class="bg-white p-6 rounded-lg shadow-md mb-6" *ngIf="isElectron">
            <h2 class="text-xl font-semibold mb-4 text-blue-600">Cloud Connection</h2>
            <div class="flex items-center justify-between">
                <p class="text-gray-600">Link your Google Drive to enable secure off-site backups.</p>
                <button (click)="connectDrive()" [disabled]="isLoading" class="btn btn-primary">
                {{ isLoading ? 'Connecting...' : 'Connect Google Drive' }}
                </button>
            </div>
            <p *ngIf="message" class="mt-2 text-sm" [ngClass]="{'text-green-600': success, 'text-red-500': !success}">
                {{ message }}
            </p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md mb-6" *ngIf="!isElectron">
                 <h2 class="text-xl font-semibold mb-4 text-gray-400">Cloud Connection</h2>
                 <p class="text-sm text-gray-500">Backup configuration is only available on the Master System.</p>
            </div>

            <!-- Backup & Restore -->
            <div class="bg-white p-6 rounded-lg shadow-md" *ngIf="isElectron">
            <h2 class="text-xl font-semibold mb-4 text-green-600">Backup & Restore</h2>
            
            <div class="mb-6 pb-6 border-b">
                <h3 class="font-bold text-gray-700 mb-2">Immediate Backup</h3>
                <p class="text-sm text-gray-500 mb-3">Upload a snapshot of your current database to Google Drive.</p>
                <button (click)="backupNow()" [disabled]="isBackupLoading" class="btn btn-success text-white">
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


        <div *ngIf="activeTab === 'users' && currentUser?.role === 'admin'">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">User Management</h2>
                <button (click)="editUser({})" class="btn btn-primary">+ Add User</button>
            </div>

            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="table table-zebra">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr *ngFor="let u of users">
                            <td class="font-bold">{{ u.username }}</td>
                            <td>{{ u.name }}</td>
                            <td>
                                <span class="badge" [ngClass]="{
                                    'badge-primary': u.role === 'admin',
                                    'badge-secondary': u.role === 'doctor',
                                    'badge-accent': u.role === 'receptionist'
                                }">{{ u.role | titlecase }}</span>
                            </td>
                            <td>
                                <button *ngIf="u.username !== 'admin'" (click)="editUser(u)" class="btn btn-xs btn-ghost text-blue-600">Edit</button>
                                <button *ngIf="u.username !== 'admin' && u.id !== currentUser?.id" (click)="deleteUser(u.id)" class="btn btn-xs btn-ghost text-red-600">Delete</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Edit User Modal -->
            <div *ngIf="editingUser" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-xl font-bold mb-4">{{ editingUser.id ? 'Edit User' : 'Add User' }}</h3>
                    <div class="space-y-4">
                        <div class="form-control">
                            <label class="label">Username</label>
                            <input [(ngModel)]="editingUser.username" [disabled]="editingUser.id" class="input input-bordered w-full">
                        </div>
                        <div class="form-control">
                             <label class="label">Name</label>
                             <input [(ngModel)]="editingUser.name" class="input input-bordered w-full">
                        </div>
                         <div class="form-control">
                             <label class="label">Role</label>
                             <select [(ngModel)]="editingUser.role" class="select select-bordered w-full">
                                 <option value="admin">Admin</option>
                                 <option value="doctor">Doctor</option>
                                 <option value="receptionist">Receptionist</option>
                                 <option value="nurse">Nurse</option>
                             </select>
                        </div>
                        <div *ngIf="editingUser.role === 'doctor'" class="space-y-4">
                            <div class="form-control">
                                <label class="label">Specialty</label>
                                <input [(ngModel)]="editingUser.specialty" class="input input-bordered w-full" placeholder="e.g. General Physician">
                            </div>
                            <div class="form-control">
                                <label class="label">License Number</label>
                                <input [(ngModel)]="editingUser.license_number" class="input input-bordered w-full">
                            </div>
                        </div>
                        <div class="form-control">
                            <label class="label">{{ editingUser.id ? 'New Password (Optional)' : 'Password' }}</label>
                            <input [(ngModel)]="editingUser.password" type="password" class="input input-bordered w-full" placeholder="********">
                        </div>
                    </div>
                    <div class="mt-6 flex justify-end gap-2">
                        <button (click)="editingUser = null" class="btn btn-ghost">Cancel</button>
                        <button (click)="saveUser()" class="btn btn-primary">Save</button>
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
  activeTab: 'general' | 'users' = 'general';

  // General
  isLoading = false;
  isBackupLoading = false;
  message = '';
  success = false;
  backups: any[] = [];
  settings = { clinic_name: '' };
  settingsSaved = false;
  isElectron = !!window.electron;

  // Users
  users: any[] = [];
  editingUser: any = null;

  currentUser: any = null;

  private dataService: DataService = inject(DataService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  // Updater
  updateStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'uptodate' | 'error' = 'idle';
  downloadProgress = 0;
  errorMessage = '';
  appVersion = '0.0.0';

  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    if (this.currentUser?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadSettings();

    if (this.isElectron) {
      this.listBackups();
    }
    this.loadUsers();

    // Listen for updates
    if (window.electron && window.electron.updater) {
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
      const s = await this.dataService.invoke<any>('getSettings');
      this.ngZone.run(() => {
        if (s) {
          this.settings.clinic_name = s.clinic_name || '';
        }
      });
    } catch (e) { console.error(e); }
  }

  async saveSettings() {
    try {
      await this.dataService.invoke('saveSettings', this.settings);
      this.ngZone.run(() => {
        this.settingsSaved = true;
        setTimeout(() => this.settingsSaved = false, 3000);
      });
    } catch (e) { console.error(e); }
  }

  // Drive methods
  async connectDrive() {
    if (!this.isElectron) return;
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
    if (!this.isElectron) return;
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
    if (!this.isElectron) return;
    try {
      const files = await window.electron.drive.listBackups();
      this.ngZone.run(() => { this.backups = files; });
    } catch (e) { console.error(e); }
  }

  async restore(fileId: string) {
    if (!this.isElectron) return;
    if (!confirm('Warning: Overwrite data?')) return;
    try {
      const result = await window.electron.drive.restore(fileId);
      if (result.success) alert('Restore Complete. Restart App.');
    } catch (e) { alert('Error'); }
  }


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

  // User Methods
  async loadUsers() {
    try {
      const users = await this.dataService.invoke<any>('getUsers');
      this.ngZone.run(() => { this.users = users; });
    } catch (e) { console.error(e); }
  }

  editUser(user: any) {
    this.editingUser = { ...user };
  }

  async saveUser() {
    if (!this.editingUser.username || (!this.editingUser.id && !this.editingUser.password)) return;
    const allowedRoles = ['admin', 'doctor', 'receptionist', 'nurse'];
    if (!this.editingUser.role || !allowedRoles.includes(this.editingUser.role)) {
      alert('Invalid Role');
      return;
    }
    try {
      await this.dataService.invoke<any>('saveUser', this.editingUser);
      this.ngZone.run(() => {
        this.editingUser = null;
        this.loadUsers();
      });
    } catch (e) { console.error(e); }
  }

  async deleteUser(id: any) {
    if (!confirm('Delete this user?')) return;
    try {
      await this.dataService.invoke<any>('deleteUser', id);
      this.ngZone.run(() => { this.loadUsers(); });
    } catch (e) { console.error(e); }
  }
}

import { Component, inject, NgZone, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { SharedTableComponent } from '../shared/components/table/table.component';
import { ActionRendererComponent } from '../shared/components/table/renderers/action-renderer.component';
import { ColDef, ValueGetterParams } from 'ag-grid-community';
import { DatePickerComponent } from '../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedTableComponent, ActionRendererComponent, DatePickerComponent],
  templateUrl: './settings.component.html',
  styles: [`
    :host { display: block; height: 100%; }
    .ng-dirty.ng-invalid { border-color: #ef4444; }
  `]
})
export class SettingsComponent implements OnInit {
  activeTab = 'users'; // users | audit
  currentUser: any = null;
  users: any[] = [];
  auditLogs: any[] = [];

  // UI State for Mobile Drawer
  isMobileMenuOpen = false;

  // Validation State
  formSubmitted = false;

  // Filter State
  staffFilter = 'all';

  appVersion = '0.0.0';

  // General Settings
  settings = {
    clinic_name: '',
    drive_client_id: '',
    drive_client_secret: '',
    local_backup_path: ''
  };
  settingsSaved = false;
  isElectron = !!(window as any).electron;

  // Cloud
  cloudEnabled = false;
  cloudClinicId: string | null = null;
  showCloudModal = false;
  cloudForm = { name: '', city: '' };
  cloudLoading = false;

  // Editing
  editingUser: any = null;

  // Security / Backup
  showRecoveryModal = false;
  confirmPassword = '';
  newRecoveryCode: string | null = null;
  isCopied = false;
  isLoading = false;
  isBackupLoading = false;
  message = '';
  success = false;
  backups: any[] = [];


  // Audit Log Column Definitions
  auditColumnDefs: ColDef[] = [
    {
      headerName: 'Time',
      field: 'timestamp',
      flex: 1,
      minWidth: 160,
      valueFormatter: (params: any) => {
        if (!params.value) return '-';
        return new DatePipe('en-US').transform(params.value, 'short') || '-';
      }
    },
    {
      headerName: 'Action By',
      field: 'actor_name', // Joined from users table
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => {
        return params.value ? `<span class="font-medium text-gray-700">${params.value}</span>` : '<span class="text-gray-400 italic">Unknown</span>';
      }
    },
    {
      headerName: 'Action',
      field: 'action',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => {
        const action = params.value || '';
        let colorClass = 'text-gray-600';
        if (action.includes('UPDATE')) colorClass = 'text-blue-600';
        if (action.includes('INSERT') || action.includes('CREATE')) colorClass = 'text-green-600';
        if (action.includes('DELETE')) colorClass = 'text-red-600';
        return `<span class="font-medium ${colorClass}">${action}</span>`;
      }
    },
    { headerName: 'Table', field: 'table_name', flex: 1, minWidth: 160 },
    { headerName: 'Record ID', field: 'record_id', flex: 1, minWidth: 150, cellClass: 'font-mono text-xs text-gray-500' },
    { headerName: 'Details', field: 'details', flex: 2, minWidth: 250, wrapText: true, autoHeight: true }
  ];

  // User Column Definitions
  userColumnDefs: ColDef[] = [
    {
      headerName: 'Employee',
      field: 'name',
      flex: 1.5,
      minWidth: 220,
      cellRenderer: (params: any) => {
        const u = params.data;
        if (!u) return '';
        const initial = u.name ? u.name.charAt(0).toUpperCase() : '?';
        const colorClass = u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600';
        const isMe = params.data.id === this.currentUser?.id ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium ml-1">YOU</span>' : '';

        return `
          <div class="flex items-center gap-3">
             <div class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                ${initial}
             </div>
             <div class="flex flex-col">
                 <span class="font-semibold text-gray-900 leading-tight">${u.name}</span>
                 <div class="text-[10px] text-gray-400 leading-tight">@${u.username} ${isMe}</div>
             </div>
          </div>
        `;
      }
    },
    {
      headerName: 'Role',
      field: 'role',
      flex: 1,
      minWidth: 150,
      cellClass: 'flex items-center',
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        const role = params.value.toUpperCase();
        let badgeClass = 'bg-gray-100 text-gray-800';
        if (role === 'ADMIN') badgeClass = 'bg-purple-100 text-purple-800';
        if (role === 'DOCTOR') badgeClass = 'bg-green-100 text-green-800';
        if (role === 'NURSE') badgeClass = 'bg-yellow-100 text-yellow-800';
        if (role === 'RECEPTIONIST') badgeClass = 'bg-blue-100 text-blue-800';

        const designation = params.data.designation ? `<span class="text-[10px] text-gray-400 ml-2">${params.data.designation}</span>` : '';

        return `
            <div class="flex items-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}">
                  ${role}
                </span>
                ${designation}
            </div>
          `;
      }
    },
    {
      headerName: 'Contact',
      field: 'contact',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (params: ValueGetterParams) => {
        const u = params.data;
        if (!u) return '';
        return u.mobile || u.email || 'No contact info';
      },
      cellRenderer: (params: any) => {
        const u = params.data;
        if (!u) return '';
        let html = '<div class="flex flex-col justify-center h-full text-xs text-gray-600">';
        if (u.mobile) html += `<div>📱 ${u.mobile}</div>`;
        if (u.email) html += `<div>✉️ ${u.email}</div>`;
        if (!u.mobile && !u.email) html += `<div class="text-gray-400 italic">No contact info</div>`;
        html += '</div>';
        return html;
      }
    },
    {
      headerName: 'DOB',
      field: 'dob',
      flex: 1,
      minWidth: 130,
      valueFormatter: (params: any) => {
        if (!params.value) return '-';
        return new DatePipe('en-US').transform(params.value, 'mediumDate') || '-';
      }
    },
    {
      headerName: 'Joined',
      field: 'joining_date',
      flex: 1,
      minWidth: 130,
      valueFormatter: (params: any) => {
        if (!params.value) return '-';
        return new DatePipe('en-US').transform(params.value, 'mediumDate') || '-';
      }
    },
    {
      headerName: 'Actions',
      flex: 1,
      minWidth: 120,
      cellRenderer: ActionRendererComponent,
      cellRendererParams: {
        onEdit: (data: any) => this.editUser(data),
        onDelete: (data: any) => this.deleteUser(data.id)
      }
    }
  ];

  // Table State
  searchTerm = '';
  pageSize = 20;
  filteredUsers: any[] = [];

  setFilter(role: string) {
    this.staffFilter = role.toLowerCase();
    this.applyFilter();
  }

  applyFilter() {
    if (this.staffFilter !== 'all') {
      this.filteredUsers = this.users.filter(u => u.role && u.role.toLowerCase() === this.staffFilter);
    } else {
      this.filteredUsers = [...this.users];
    }
  }

  // Navigation Helper
  switchTab(tab: string) {
    this.activeTab = tab;
    this.isMobileMenuOpen = false;

    // Additional logic if needed per tab
    if (tab === 'audit') {
      this.loadAuditLogs();
    }
  }

  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private router = inject(Router);
  constructor(private ngZone: NgZone) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.loadSettings();
    if (this.isElectron) {
      this.listBackups();
      this.loadCloudStatus();
    }
    if (this.currentUser?.role === 'admin') {
      this.loadUsers();
    }
  }

  async loadSettings() {
    try {
      const s = await this.dataService.invoke<any>('getSettings');
      this.ngZone.run(() => {
        if (s) {
          this.settings.clinic_name = s.clinic_name || '';
          this.settings.drive_client_id = s.drive_client_id || '';
          this.settings.drive_client_secret = s.drive_client_secret || '';
          this.settings.local_backup_path = s.local_backup_path || '';
        }
      });
    } catch (e) { console.error(e); }
  }

  async selectBackupPath() {
    if (!this.isElectron) return;
    try {
      const path = await window.electron.backup.selectPath();
      if (path) {
        this.ngZone.run(() => this.settings.local_backup_path = path);
        this.saveSettings(); // Auto-save
      }
    } catch (e) { console.error(e); }
  }

  async useDefaultBackupPath() {
    if (!this.isElectron) return;
    try {
      const path = await window.electron.backup.useDefaultPath();
      if (path) {
        this.ngZone.run(() => this.settings.local_backup_path = path); // Update UI
        // We should also clear it in the DB settings so it falls back to default logic? 
        // Or explicitly save the default path? The requirement says "Use Default Location".
        // Saving the explicit default path is safer to ensure consistency.
        this.saveSettings();
      }
    } catch (e) { console.error(e); }
  }

  async saveSettings() {
    try {
      await this.dataService.invoke('saveSettings', this.settings);
      this.ngZone.run(() => { this.settingsSaved = true; setTimeout(() => this.settingsSaved = false, 3000); });
    } catch (e) { console.error(e); }
  }

  async loadUsers() {
    try {
      const u = await this.dataService.invoke<any>('getUsers');
      this.ngZone.run(() => {
        this.users = u;
        this.applyFilter();
      });
    } catch (e) { console.error(e); }
  }

  editUser(user: any) {
    this.editingUser = {
      active: 1,
      role: 'nurse',
      password_reset_required: 1,
      ...user
    };
    this.formSubmitted = false;
  }

  validateUser(user: any): string[] {
    const errors = [];
    if (!user.username || user.username.length < 3) errors.push('Username must be at least 3 characters.');
    if (!user.name || user.name.length < 2) errors.push('Full Name is required.');
    if (!user.role) errors.push('Role is required.');

    if (user.mobile && !/^\d{10}$/.test(user.mobile)) {
      errors.push('Mobile number must be exactly 10 digits.');
    }

    if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      errors.push('Invalid email format.');
    }

    if (!user.id && (!user.password || user.password.length < 4)) {
      errors.push('Password must be at least 4 characters.');
    }

    return errors;
  }

  async saveUser() {
    this.formSubmitted = true;

    const errors = this.validateUser(this.editingUser);
    if (errors.length > 0) {
      alert(errors.join('\\n'));
      return;
    }

    try {
      await this.dataService.invoke('saveUser', this.editingUser);
      this.ngZone.run(() => {
        this.editingUser = null;
        this.loadUsers();
        alert('Profile Saved');
      });
    } catch (e: any) {
      console.error(e);
      const msg = e.toString();
      if (msg.includes('UNIQUE constraint failed: users.username')) {
        alert('Username already exists. Please choose another.');
      } else {
        alert('Error saving user: ' + msg);
      }
    }
  }

  async deleteUser(id: number) {
    if (!confirm('Are you sure? This will remove access for this user.')) return;
    try {
      await this.dataService.invoke('deleteUser', id);
      this.ngZone.run(() => this.loadUsers());
    } catch (e) { console.error(e); }
  }

  // Batch Selection
  selectedUsers: any[] = [];

  async deleteSelectedUsers() {
    if (this.selectedUsers.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${this.selectedUsers.length} users? This cannot be undone.`)) return;

    try {
      // Execute in parallel or sequential? 
      // SQLite handles concurrency poorly if not managed, but dataService.invoke should handle it.
      // Better to do sequential to avoid locking if the main process handles one by one.
      for (const user of this.selectedUsers) {
        await this.dataService.invoke('deleteUser', user.id);
      }
      this.ngZone.run(() => {
        this.selectedUsers = [];
        this.loadUsers();
        alert('Users deleted successfully');
      });
    } catch (e) { console.error(e); alert('Error deleting users'); }
  }

  async loadAuditLogs() {
    try {
      const logs = await this.dataService.invoke<any>('getAuditLogs', 100);
      this.ngZone.run(() => this.auditLogs = logs);
    } catch (e) { console.error(e); }
  }

  openRecoveryModal() {
    this.confirmPassword = '';
    this.newRecoveryCode = null;
    this.showRecoveryModal = true;
  }
  closeRecoveryModal() {
    this.showRecoveryModal = false;
  }
  async generateRecoveryCode() {
    if (!this.confirmPassword) return;
    this.isLoading = true;
    try {
      const res = await this.authService.regenerateRecoveryCode(this.confirmPassword) as any;
      this.ngZone.run(() => {
        this.isLoading = false;
        if (res.success && res.recoveryCode) this.newRecoveryCode = res.recoveryCode;
        else alert(res.error || 'Failed');
      });
    } catch { this.isLoading = false; }
  }
  async copyRecoveryCode() {
    if (this.newRecoveryCode) {
      if (window.electron) await window.electron.clipboard.writeText(this.newRecoveryCode);
      else navigator.clipboard.writeText(this.newRecoveryCode);
      this.ngZone.run(() => { this.isCopied = true; setTimeout(() => this.isCopied = false, 2000); });
    }
  }

  async connectDrive() {
    if (!this.isElectron) return;
    this.isLoading = true;
    try {
      const res = await window.electron.drive.authenticate() as any;
      this.ngZone.run(() => {
        this.isLoading = false;
        this.success = !!res;
        this.message = res ? 'Connected' : 'Failed';
        if (res) this.listBackups();
      });
    } catch { this.isLoading = false; }
  }
  async listBackups() {
    if (!this.isElectron) return;
    const files = await window.electron.drive.listBackups();
    this.ngZone.run(() => this.backups = files || []);
  }
  async backupNow() {
    if (!this.isElectron) return;
    this.isBackupLoading = true;
    try {
      const res = await window.electron.drive.backup() as any;
      this.ngZone.run(() => {
        this.isBackupLoading = false;
        if (res.success) { alert('Backup Complete'); this.listBackups(); }
        else alert('Failed: ' + res.error);
      });
    } catch { this.isBackupLoading = false; }
  }
  async restore(id: string) {
    if (!confirm('Overwrite local database? This is irreversible.')) return;
    await window.electron.drive.restore(id);
    alert('Restore initiated. App will restart.');
  }

  async loadCloudStatus() {
    if (!this.isElectron) return;
    const s = await window.electron.cloud.getStatus();
    this.ngZone.run(() => { this.cloudEnabled = s.enabled; this.cloudClinicId = s.clinicId; });
  }
  async toggleCloud(e: any) {
    if (!this.isElectron) return;
    const enabled = e.target.checked;
    if (enabled && !this.cloudClinicId) {
      this.showCloudModal = true;
      e.target.checked = false;
    } else {
      await window.electron.cloud.toggle(enabled);
      this.loadCloudStatus();
    }
  }
  async submitCloudOnboard() {
    // ... existing ...
  }

  openDriveConsole(e: Event) {
    e.preventDefault();
    if (window.electron && window.electron.utils) {
      window.electron.utils.openExternal('https://console.cloud.google.com/');
    }
  }

  openSetupGuide(e: Event) {
    e.preventDefault();
    if (window.electron && window.electron.utils) {
      // Link to local doc or online wiki? Using prompt's request for "User Guide"
      // Since we don't have a hosted wiki yet, I'll point to the repo docs or a placeholder.
      // User asked to "create a new page in nalamdesk documentation user guide... and add a link".
      // I should probably link to the hosted version of that doc. 
      // For now, I'll link to the repository documentation folder.
      window.electron.utils.openExternal('https://github.com/sankara-sabapathy/nalamdesk/blob/main/cloud/documentation/user-guide/backups.md');
    }
  }
}

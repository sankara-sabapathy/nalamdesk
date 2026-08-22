import { Component, NgZone, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { RuntimeService } from '../services/runtime.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div class="bg-gray-800 p-8 rounded-lg shadow-xl w-96 border border-gray-700">
        <h2 class="text-2xl font-bold mb-6 text-center text-blue-400">NalamDesk</h2>
        
        <div *ngIf="error" class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-sm">
          {{ error }}
        </div>
        <div *ngIf="vaultNotice" class="bg-blue-950/60 border border-blue-600 text-blue-100 px-4 py-2 rounded mb-4 text-sm">
          {{ vaultNotice }}
        </div>

        <div *ngIf="pendingRecoveryCode" class="bg-amber-950 border border-amber-500 p-4 rounded mb-4 text-sm">
          <p class="font-bold text-amber-300 mb-2">Security upgrade complete</p>
          <p class="text-amber-100 mb-2">Save this new recovery code before continuing. The old vault password wrapper has been removed.</p>
          <code class="block bg-gray-950 p-2 rounded select-all break-all">{{ pendingRecoveryCode }}</code>
          <button type="button" (click)="acknowledgeMigration()" class="mt-3 w-full bg-amber-600 hover:bg-amber-700 py-2 rounded font-bold">
            I have saved this code
          </button>
        </div>

        <form (ngSubmit)="onLogin()" *ngIf="!pendingRecoveryCode">
          <div class="mb-4">
            <label class="block text-gray-400 text-sm font-bold mb-2" for="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              [(ngModel)]="username"
              name="username"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter username..."
              [disabled]="isLoading"
              autofocus
            >
          </div>

          <div class="mb-4">
            <label class="block text-gray-400 text-sm font-bold mb-2" for="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter password..."
              [disabled]="isLoading"
            >
          </div>
          
      <button
            type="submit"
            [disabled]="isLoading || !password || !username"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
        
        <div class="mt-4 text-center flex justify-between text-xs text-gray-400">
            <a routerLink="/recover" class="hover:text-blue-400">Recover Device</a>
            <div class="flex flex-col items-end">
                <span>Secure Local-First Access</span>
                <div *ngIf="runtime.lanAccessUrl" class="mt-1 flex items-center gap-1.5 bg-gray-700/50 px-2 py-0.5 rounded-md border border-gray-600/30">
                    <span class="relative flex h-1.5 w-1.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                    <span class="font-mono text-[10px] text-gray-400">{{ runtime.lanAccessUrl }}</span>
                 </div>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  error = '';
  isLoading = false;
  pendingRecoveryCode = '';
  vaultNotice = '';
  private pendingRoute = '/dashboard';
  isElectron = !!(globalThis as any).electron;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private authService: AuthService,
    public runtime: RuntimeService
  ) { }

  async ngOnInit() {
    // Check if Setup is required
    const status = await this.authService.checkSetup();
    if (!status.isSetup) {
      this.router.navigate(['/setup']);
    } else if (status.vaultState === 'legacy-migration-required') {
      this.vaultNotice = 'Security upgrade required: the administrator must sign in once. A new recovery code will be shown.';
    } else if (status.vaultState === 'recovery-required') {
      this.vaultNotice = 'This device cannot access its protected vault key. Use Recover Device below.';
    }

    if (this.isElectron) {
      this.runtime.init();
    }
  }

  async onLogin() {
    if (!this.password || !this.username) return;

    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.authService.login(this.username, this.password);

      this.ngZone.run(() => {
        this.isLoading = false;
        if (result.success) {

          const user = this.authService.getUser();
          this.password = ''; // Clear sensitive data

          this.pendingRoute = user && user.password_reset_required ? '/change-password' : '/dashboard';
          if (result.pendingRecoveryCode) {
            this.pendingRecoveryCode = result.pendingRecoveryCode;
          } else {
            this.router.navigate([this.pendingRoute]);
          }
        } else {
          this.password = ''; // Clear sensitive data on failure too
          this.error = result.error || 'Login failed';

          if (this.error === 'SYSTEM_LOCKED') {
            this.error = 'System Locked. Please login as Administrator to unlock.';
          } else if (this.error === 'RECOVERY_REQUIRED') {
            this.error = 'Device recovery is required before anyone can sign in.';
          } else if (this.error === 'VAULT_BINDING_MISMATCH') {
            this.error = 'The database and security metadata do not belong to the same vault.';
          }
        }
      });
    } catch (e) {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.error = 'Login Error';
        console.error(e);
      });
    }
  }

  async acknowledgeMigration() {
    await this.authService.acknowledgeRecoveryCode(this.pendingRecoveryCode);
    this.pendingRecoveryCode = '';
    this.router.navigate([this.pendingRoute]);
  }
}

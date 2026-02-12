import { Component, NgZone, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

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

        <form (ngSubmit)="onLogin()">
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
            <a routerLink="/recover" class="hover:text-blue-400">Forgot Password?</a>
            <div class="flex flex-col items-end">
                <span>Secure Local-First Access</span>
                <div *ngIf="localIp" class="mt-1 flex items-center gap-1.5 bg-gray-700/50 px-2 py-0.5 rounded-md border border-gray-600/30">
                    <span class="relative flex h-1.5 w-1.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                    <span class="font-mono text-[10px] text-gray-400">http://{{localIp}}:3000</span>
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
  localIp = '';
  isElectron = !!(globalThis as any).electron;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private authService: AuthService
  ) { }

  async ngOnInit() {
    // Check if Setup is required
    const status = await this.authService.checkSetup();
    if (!status.isSetup) {
      this.router.navigate(['/setup']);
    }

    if (this.isElectron) {
      this.loadLocalIp();
    }
  }

  async loadLocalIp() {
    try {
      const ip = await (window as any).electron.utils.getLocalIp();
      this.ngZone.run(() => {
        this.localIp = ip;
      });
    } catch (e) {
      console.error('Failed to load local IP', e);
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

          if (user && user.password_reset_required) {
            this.router.navigate(['/change-password']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.password = ''; // Clear sensitive data on failure too
          this.error = result.error || 'Login failed';

          if (this.error === 'SYSTEM_LOCKED') {
            this.error = 'System Locked. Please login as Administrator to unlock.';
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
}

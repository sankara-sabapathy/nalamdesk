import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
      <div class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <h2 class="text-2xl font-bold mb-6 text-center text-red-400">Recover Password</h2>
        
        <div *ngIf="error" class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-6 text-sm">
          {{ error }}
        </div>
        
        <div *ngIf="success" class="bg-green-100 border border-green-500 rounded p-6 mb-6">
          <h3 class="text-green-800 font-bold text-lg mb-2">Password Reset Successful!</h3>
          <p class="text-green-700 text-sm mb-4">
              Your recovery code has been rotated for security. 
              <strong>You must save this new code</strong> to recover your account in the future.
          </p>
          
          <div class="bg-white p-3 rounded border border-gray-300 mb-4 flex justify-between items-center">
              <code class="text-lg font-mono font-bold text-gray-800">{{ newRecoveryCode }}</code>
              <button (click)="copyCode()" class="text-sm text-blue-600 hover:text-blue-800 font-bold">
                  {{ isCopied ? 'Copied!' : 'Copy' }}
              </button>
          </div>

          <div class="flex justify-center">
              <button (click)="finish()" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded">
                  I have saved this code
              </button>
          </div>
        </div>

        <form (ngSubmit)="onRecover()" *ngIf="!success">
            <!-- Recovery Code Input -->
            <div class="mb-4">
            <label class="block text-gray-400 text-sm font-bold mb-2">
              Recovery Code
            </label>
            <input
              type="text"
              [(ngModel)]="recoveryCode"
              name="recoveryCode"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white font-mono uppercase tracking-widest focus:outline-none focus:border-red-500 transition-colors"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              [disabled]="isLoading"
              autofocus
            >
            <p class="text-xs text-gray-500 mt-1">Enter the code provided during setup.</p>
          </div>

          <!-- New Password -->
          <div class="mb-4">
            <label class="block text-gray-400 text-sm font-bold mb-2">
              New Master Password
            </label>
            <input
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Enter new password"
              [disabled]="isLoading"
            >
          </div>

           <!-- Confirm Password -->
          <div class="mb-6">
            <label class="block text-gray-400 text-sm font-bold mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Confirm new password"
              [disabled]="isLoading"
            >
          </div>
          
          <button
            type="submit"
            [disabled]="isLoading || !recoveryCode || !newPassword || newPassword !== confirmPassword"
            class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'Recovering...' : 'Reset Password' }}
          </button>
        </form>
        
        <div class="mt-4 text-center">
            <a routerLink="/login" class="text-sm text-blue-400 hover:text-blue-300">Back to Login</a>
        </div>
      </div>
    </div>
  `
})
export class RecoveryComponent {
  recoveryCode = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  success = false;
  isLoading = false;

  newRecoveryCode: string | null = null;
  isCopied = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  async onRecover() {
    if (!this.recoveryCode || !this.newPassword) return;
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.authService.recover({
        recoveryCode: this.recoveryCode.trim(),
        newPassword: this.newPassword
      });

      if (result.success && result.recoveryCode) {
        this.success = true;
        this.newRecoveryCode = result.recoveryCode;
        this.isLoading = false;
      } else {
        this.error = result.error || 'Recovery Failed. Check your code.';
        this.isLoading = false;
      }
    } catch (e) {
      this.isLoading = false;
      this.error = 'System Error';
      console.error(e);
    }
  }

  async copyCode() {
    if (this.newRecoveryCode) {
      if (window.electron) {
        await window.electron.clipboard.writeText(this.newRecoveryCode);
      } else {
        navigator.clipboard.writeText(this.newRecoveryCode);
      }
      this.isCopied = true;
      setTimeout(() => this.isCopied = false, 2000);
    }
  }

  finish() {
    this.router.navigate(['/login']);
  }
}

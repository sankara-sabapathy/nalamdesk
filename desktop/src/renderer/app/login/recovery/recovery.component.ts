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
        <h2 class="text-2xl font-bold mb-6 text-center text-red-400">Recover This Device</h2>
        
        <div *ngIf="error" class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-6 text-sm">
          {{ error }}
        </div>
        
        <div *ngIf="success" class="bg-green-100 border border-green-500 rounded p-6 mb-6">
          <h3 class="text-green-800 font-bold text-lg mb-2">Device Recovery Successful</h3>
          <p class="text-green-700 text-sm mb-4">
              This device can access the clinic vault again. User passwords were not changed.
          </p>
          <div *ngIf="newRecoveryCode" class="bg-white p-3 rounded border border-gray-300 mb-4">
            <p class="text-red-700 text-xs mb-2">The legacy recovery wrapper was replaced. Save this new code:</p>
            <code class="block text-lg font-mono font-bold text-gray-800 select-all break-all">{{ newRecoveryCode }}</code>
            <button (click)="copyCode()" class="mt-2 text-sm text-blue-600 font-bold">{{ isCopied ? 'Copied!' : 'Copy' }}</button>
          </div>
          <div class="flex justify-center">
              <button (click)="finish()" [disabled]="isLoading" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ isLoading ? 'Confirming...' : (newRecoveryCode ? 'I have saved this code' : 'Return to Login') }}
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
            <p class="text-xs text-gray-500 mt-1">Enter the portable vault recovery code provided during setup.</p>
          </div>
          
          <button
            type="submit"
            [disabled]="isLoading || !recoveryCode"
            class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'Recovering...' : 'Recover Device' }}
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
  error = '';
  success = false;
  isLoading = false;
  newRecoveryCode = '';
  isCopied = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  async onRecover() {
    if (!this.recoveryCode) return;

    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.authService.recover({
        recoveryCode: this.recoveryCode.trim()
      });

      if (result.success) {
        this.success = true;
        this.newRecoveryCode = result.pendingRecoveryCode || '';
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
    if (!this.newRecoveryCode) return;
    if (window.electron) await window.electron.clipboard.writeText(this.newRecoveryCode);
    else await navigator.clipboard.writeText(this.newRecoveryCode);
    this.isCopied = true;
  }

  async finish() {
    if (!this.newRecoveryCode) {
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading = true;
    this.error = '';
    try {
      const result = await this.authService.acknowledgeRecoveryCode(this.newRecoveryCode);
      if (!result.success) {
        this.error = 'Could not confirm the recovery code. Please try again.';
        return;
      }
      this.newRecoveryCode = '';
      this.router.navigate(['/login']);
    } catch (error) {
      this.error = 'Could not confirm the recovery code. Please try again.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }
}

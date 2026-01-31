import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        
        <p class="mt-4 text-xs text-gray-500 text-center">
          Secure Local-First Access.
        </p>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  isLoading = false;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private authService: AuthService
  ) { }

  async onLogin() {
    if (!this.password || !this.username) return;

    this.isLoading = true;
    this.error = '';

    try {
      const result = await this.authService.login(this.username, this.password);

      this.ngZone.run(() => {
        this.isLoading = false;
        if (result.success) {
          this.password = ''; // Clear sensitive data
          this.router.navigate(['/dashboard']);
        } else {
          this.password = ''; // Clear sensitive data on failure too
          this.error = result.error || 'Login failed';
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

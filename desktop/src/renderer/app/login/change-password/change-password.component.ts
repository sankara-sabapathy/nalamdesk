import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-change-password',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Change Password</h2>
        <p class="text-sm text-gray-600 mb-6 text-center">
            Your administrator has required you to change your password before proceeding.
        </p>

        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">New Password</label>
            <input type="password" [(ngModel)]="password" name="password" required minlength="6"
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm New Password</label>
            <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" required
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border">
            <p *ngIf="password && confirmPassword && password !== confirmPassword" class="text-xs text-red-500 mt-1">
                Passwords do not match
            </p>
          </div>

          <div *ngIf="error" class="text-red-600 text-sm text-center">
            {{ error }}
          </div>

          <button type="submit" [disabled]="!isValid() || isLoading"
                  class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
            {{ isLoading ? 'Updating...' : 'Set Password' }}
          </button>
        </form>
      </div>
    </div>
  `
})
export class ChangePasswordComponent {
    password = '';
    confirmPassword = '';
    isLoading = false;
    error = '';

    private auth = inject(AuthService);
    private router = inject(Router);

    isValid() {
        return this.password.length >= 6 && this.password === this.confirmPassword;
    }

    async onSubmit() {
        if (!this.isValid()) return;
        this.isLoading = true;
        this.error = '';

        try {
            const user = this.auth.getUser();
            if (!user) {
                this.router.navigate(['/login']);
                return;
            }

            const success = await this.auth.updatePassword(user.username, this.password);
            if (success) {
                // Update local user state to reflect reset is no longer required
                const updatedUser = { ...user, password_reset_required: 0 };

                // Just update local storage directly as a quick fix, since setToken/setUser logic is private or simple
                localStorage.setItem('nalamdesk_user', JSON.stringify(updatedUser));

                // Navigate to dashboard
                this.router.navigate(['/dashboard']);
            } else {
                this.error = 'Failed to update password';
            }
        } catch (e: any) {
            this.error = e.message || 'An error occurred';
        } finally {
            this.isLoading = false;
        }
    }
}

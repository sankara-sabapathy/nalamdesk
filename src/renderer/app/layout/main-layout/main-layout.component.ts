import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { UniversalDialogComponent } from '../../shared/components/universal-dialog/universal-dialog.component';
import { DialogService } from '../../shared/services/dialog.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, UniversalDialogComponent],
  template: `
    <div class="drawer lg:drawer-open font-sans">
      <input id="main-drawer" type="checkbox" class="drawer-toggle" />
      
      <div class="drawer-content flex flex-col min-h-screen bg-base-200">
        <!-- Window Title Bar Spacer -->
        <div class="w-full h-8 bg-base-100 flex-none sticky top-0 z-50" style="-webkit-app-region: drag"></div>

        <!-- Header -->
        <div class="navbar bg-base-100 shadow-sm sticky top-8 z-30 h-16 border-b border-base-200">
          <div class="flex-none lg:hidden">
            <label for="main-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </label>
          </div>
          <div class="flex-1 px-4 flex items-center gap-3">
             <!-- Mobile Logo -->
             <div class="w-8 h-8 rounded overflow-hidden lg:hidden bg-transparent">
                <img src="assets/logo.png" alt="NalamDesk" class="w-full h-full object-cover transform scale-125" />
             </div>
            <div class="text-sm breadcrumbs">
              <ul>
                <li><span class="opacity-50">App</span></li>
                <li class="font-medium text-primary">{{ currentRouteName }}</li>
              </ul>
            </div>
          </div>
          <div class="flex-none gap-4 px-4">
             <!-- Theme Toggle (Simplified for now) -->
             <div class="dropdown dropdown-end">
                <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder">
                  <div class="bg-neutral text-neutral-content rounded-full w-10">
                    <span>Dr</span>
                  </div>
                </div>
                <ul tabindex="0" class="mt-3 z-[1] p-2 shadow-menu menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                  <li><a>Profile</a></li>
                  <li><a>Settings</a></li>
                  <li><a class="text-error" (click)="logout()">Logout</a></li>
                </ul>
             </div>
          </div>
        </div>

        <!-- Main Content -->
        <main class="flex-1 p-6 overflow-y-auto">
           <router-outlet></router-outlet>
        </main>
      </div> 
      
      <!-- Sidebar -->
      <div class="drawer-side z-40">
        <label for="main-drawer" aria-label="close sidebar" class="drawer-overlay"></label> 
        <ul class="menu p-4 w-72 min-h-full bg-base-100 text-base-content border-r border-base-200 gap-1">
          <!-- Logo Area -->
          <li class="mb-6 mt-2">
            <div class="flex items-center gap-3 px-2 hover:bg-transparent">
              <div class="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-transparent relative group">
                 <div class="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"></div>
                 <img src="assets/icon.png" alt="NalamDesk" class="w-[140%] h-[140%] max-w-none object-cover transform scale-125" />
              </div>
              <div>
                <div class="font-bold text-lg leading-tight tracking-tight">NalamDesk</div>
                <div class="text-xs opacity-50 font-medium tracking-wide">PRACTICE</div>
              </div>
            </div>
          </li>

          <!-- Navigation Items -->
          <li class="menu-title px-2 uppercase tracking-wider font-bold text-[11px] opacity-50 mt-2">Menu</li>
          
          <li>
            <a routerLink="/dashboard" routerLinkActive="bg-primary text-primary-content shadow-lg shadow-blue-500/30 font-semibold" class="group">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-active:text-primary"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              Dashboard
            </a>
          </li>
          
          <li class="menu-title px-2 uppercase tracking-wider font-bold text-[11px] opacity-50 mt-4">Patient Management</li>

          <li>
            <a routerLink="/queue" routerLinkActive="bg-primary text-primary-content shadow-lg shadow-blue-500/30 font-semibold" class="group">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              Queue
              <span class="badge badge-sm badge-secondary ml-auto" *ngIf="queueCount > 0">{{ queueCount }}</span>
            </a>
          </li>
          <li>
            <a routerLink="/patients" routerLinkActive="bg-primary text-primary-content shadow-lg shadow-blue-500/30 font-semibold" class="group">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Patients
            </a>
          </li>
          <li>
            <a routerLink="/visits" routerLinkActive="bg-primary text-primary-content shadow-lg shadow-blue-500/30 font-semibold" class="group">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Visits
            </a>
          </li>

           <li class="menu-title px-2 uppercase tracking-wider font-bold text-[11px] opacity-50 mt-4">System</li>

          <li>
            <a routerLink="/settings" routerLinkActive="bg-primary text-primary-content shadow-lg shadow-blue-500/30 font-semibold" class="group">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Settings
            </a>
          </li>
        </ul>
      </div>
    </div>
    
    <app-universal-dialog
      [isOpen]="dialogService.isOpen()"
      [title]="dialogService.options().title"
      [message]="dialogService.options().message"
      [icon]="dialogService.options().icon ?? true"
      (confirm)="dialogService.confirm()"
      (cancel)="dialogService.close()"
      (isOpenChange)="!$event ? dialogService.close() : null">
      
      <div actions class="flex gap-2 w-full justify-end">
         <button *ngIf="dialogService.options().type === 'confirm'" 
                 class="btn btn-ghost" (click)="dialogService.close()">
           {{ dialogService.options().cancelText }}
         </button>
         <button class="btn btn-primary" (click)="dialogService.confirm()">
           {{ dialogService.options().confirmText }}
         </button>
      </div>
    </app-universal-dialog>
  `,
  styles: [`
    .menu a {
        @apply rounded-lg font-medium text-base-content/70 hover:text-base-content hover:bg-base-200 transition-all duration-200 outline-none;
    }
    .menu a.active, .menu a.bg-primary, .menu a.bg-primary:focus, .menu a.bg-primary:hover {
        @apply !text-white;
        background-color: oklch(var(--p)) !important; /* Force primary color */
    }
    .menu a.active svg, .menu a.bg-primary svg, .menu a.bg-primary:focus svg, .menu a.bg-primary:hover svg {
        @apply !stroke-white;
    }
  `]
})
export class MainLayoutComponent {
  dialogService = inject(DialogService);
  queueCount = 0; // TODO: Connect to service

  constructor(private router: Router) { }

  get currentRouteName(): string {
    // Simple extraction, can be enhanced
    const url = this.router.url.split('/')[1];
    if (!url) return 'Dashboard';
    return url.charAt(0).toUpperCase() + url.slice(1);
  }

  logout() {
    this.router.navigate(['/login']);
  }
}

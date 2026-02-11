import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

import { UniversalDialogComponent } from './shared/components/universal-dialog/universal-dialog.component';

import { BackupSetupComponent } from './setup/backup-setup.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UniversalDialogComponent, BackupSetupComponent],
  template: `
    <router-outlet></router-outlet>
    <app-universal-dialog></app-universal-dialog>
    <app-backup-setup></app-backup-setup>
  `
})
export class AppComponent {
  // Inject ThemeService so it runs at app startup (sets `data-theme`).
  // Without this, DaisyUI theme tokens can look inconsistent depending on environment defaults.
  constructor(private _themeService: ThemeService) { }
}

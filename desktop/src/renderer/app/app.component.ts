import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

import { UniversalDialogComponent } from './shared/components/universal-dialog/universal-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UniversalDialogComponent],
  template: `
    <router-outlet></router-outlet>
    <app-universal-dialog></app-universal-dialog>
  `
})
export class AppComponent {
  // Inject ThemeService so it runs at app startup (sets `data-theme`).
  // Without this, DaisyUI theme tokens can look inconsistent depending on environment defaults.
  constructor(private themeService: ThemeService) {
    void this.themeService;
  }
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent {
  // Inject ThemeService so it runs at app startup (sets `data-theme`).
  // Without this, DaisyUI theme tokens can look inconsistent depending on environment defaults.
  constructor(private themeService: ThemeService) {
    void this.themeService;
  }
}

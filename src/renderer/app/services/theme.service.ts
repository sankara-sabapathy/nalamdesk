
import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    currentTheme = signal<string>('light');

    constructor() {
        // Set theme immediately before Angular renders
        // This ensures CSS variables are available from the start
        if (typeof document !== 'undefined') {
            const saved = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', saved);
            this.currentTheme.set(saved);
        }
    }

    setTheme(theme: string) {
        this.currentTheme.set(theme);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }
    }
}

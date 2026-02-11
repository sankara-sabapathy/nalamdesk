/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
    let service: ThemeService;

    beforeEach(() => {
        localStorage.clear();
        // Reset document dataset
        delete document.documentElement.dataset['theme'];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should default to light theme when no saved theme', () => {
            service = new ThemeService();
            expect(service.currentTheme()).toBe('light');
            expect(document.documentElement.dataset['theme']).toBe('light');
        });

        it('should load saved theme from localStorage', () => {
            localStorage.setItem('theme', 'dark');
            service = new ThemeService();
            expect(service.currentTheme()).toBe('dark');
            expect(document.documentElement.dataset['theme']).toBe('dark');
        });
    });

    describe('setTheme', () => {
        beforeEach(() => {
            service = new ThemeService();
        });

        it('should update signal value', () => {
            service.setTheme('dark');
            expect(service.currentTheme()).toBe('dark');
        });

        it('should update document dataset', () => {
            service.setTheme('dark');
            expect(document.documentElement.dataset['theme']).toBe('dark');
        });

        it('should persist to localStorage', () => {
            service.setTheme('dark');
            expect(localStorage.getItem('theme')).toBe('dark');
        });

        it('should handle switching back to light', () => {
            service.setTheme('dark');
            service.setTheme('light');
            expect(service.currentTheme()).toBe('light');
            expect(document.documentElement.dataset['theme']).toBe('light');
            expect(localStorage.getItem('theme')).toBe('light');
        });
    });
});

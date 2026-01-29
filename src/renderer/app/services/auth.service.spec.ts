/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(() => {
        service = new AuthService();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete (window as any).electron;
    });

    describe('login (Electron Mode)', () => {
        it('should login successfully via electron IPC', async () => {
            // Mock window.electron
            (window as any).electron = {
                login: vi.fn().mockResolvedValue({ success: true, user: { id: 1, role: 'admin' } })
            };

            const result = await service.login('admin', 'pass');
            expect(result.success).toBe(true);
            expect(service.getUser()).toEqual({ id: 1, role: 'admin' });
            expect(window.electron.login).toHaveBeenCalledWith({ username: 'admin', password: 'pass' });
        });

        it('should handle login failure', async () => {
            (window as any).electron = {
                login: vi.fn().mockResolvedValue({ success: false, error: 'Invalid' })
            };

            const result = await service.login('admin', 'wrong');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid');
            expect(service.getUser()).toBeNull();
        });

        it('should catch ipc errors', async () => {
            (window as any).electron = {
                login: vi.fn().mockRejectedValue(new Error('IPC Error'))
            };
            const result = await service.login('a', 'b');
            expect(result.success).toBe(false);
            expect(result.error).toBe('IPC Error');
        });
    });

    describe('login (Web Mode)', () => {
        it('should login via fetch', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ token: 'jwt-token', user: { id: 2 } })
            });
            global.fetch = mockFetch;

            const result = await service.login('user', 'pass');
            expect(result.success).toBe(true);
            expect(service.getToken()).toBe('jwt-token');
            expect(service.getUser()).toEqual({ id: 2 });
            expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ username: 'user', password: 'pass' })
            }));
        });

        it('should handle fetch failure', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: false,
                json: async () => ({ error: 'Auth Failed' })
            });
            global.fetch = mockFetch;

            const result = await service.login('u', 'p');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Auth Failed');
            expect(service.getToken()).toBeNull();
        });
    });

    describe('Session Management', () => {
        it('should logout by clearing storage', () => {
            service['setUser']({ id: 1 });
            expect(service.getUser()).toBeTruthy();

            // Mock location.reload to prevent actual reload
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { reload: vi.fn() }
            });

            service.logout();
            expect(service.getUser()).toBeNull();
            expect(window.location.reload).toHaveBeenCalled();
        });
    });
});

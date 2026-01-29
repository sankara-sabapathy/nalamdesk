/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataService } from './api.service';
import { AuthService } from './auth.service';

describe('DataService', () => {
    let service: DataService;
    let mockAuthService: any;

    beforeEach(() => {
        mockAuthService = {
            getToken: vi.fn(),
            getUser: vi.fn()
        };
        service = new DataService(mockAuthService);
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete (window as any).electron;
    });

    describe('invoke (Electron Mode)', () => {
        it('should call local electron db method', async () => {
            const mockFn = vi.fn().mockResolvedValue('success');
            (window as any).electron = {
                db: { testMethod: mockFn }
            };

            const result = await service.invoke('testMethod', 'arg1');
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledWith('arg1');
        });

        it('should throw if method not found locally', async () => {
            (window as any).electron = { db: {} };
            await expect(service.invoke('missing')).rejects.toThrow('Method missing not implemented locally');
        });
    });

    describe('invoke (Web Mode)', () => {
        beforeEach(() => {
            mockAuthService.getToken.mockReturnValue('valid-token');
        });

        it('should call fetch with token', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: 'remote' })
            });
            global.fetch = mockFetch;

            const result = await service.invoke('remoteMethod', 123);
            expect(result).toEqual({ data: 'remote' });
            expect(mockFetch).toHaveBeenCalledWith('/api/ipc/remoteMethod', expect.objectContaining({
                headers: expect.objectContaining({ 'Authorization': 'Bearer valid-token' }),
                body: JSON.stringify([123])
            }));
        });

        it('should throw if not authenticated', async () => {
            mockAuthService.getToken.mockReturnValue(null);
            await expect(service.invoke('any')).rejects.toThrow('Not authenticated');
        });

        it('should handle server errors', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: false,
                headers: { get: () => 'application/json' },
                json: async () => ({ error: 'Server Boom' })
            });
            global.fetch = mockFetch;

            await expect(service.invoke('crash')).rejects.toThrow('Server Boom');
        });
    });
});

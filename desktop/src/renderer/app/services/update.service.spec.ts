/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppUpdateService } from './update.service';

describe('AppUpdateService', () => {
    let service: AppUpdateService;
    let updates: any;

    beforeEach(() => {
        updates = {
            check: vi.fn(),
            download: vi.fn(),
            install: vi.fn(),
            cancel: vi.fn(),
            onEvent: vi.fn().mockReturnValue(() => undefined)
        };
        (globalThis as any).electron = {
            updates,
            getAppVersion: vi.fn().mockResolvedValue({ packaged: true, version: '0.0.8' })
        };
        service = new AppUpdateService({ run: (fn: () => void) => fn() } as any);
    });

    afterEach(() => {
        delete (globalThis as any).electron;
    });

    it('opens Update now / Later when a newer feed version is available', async () => {
        updates.check.mockResolvedValue({
            state: 'available',
            currentVersion: '0.0.8',
            availableVersion: '0.0.9',
            verifiedSignature: false
        });
        const status = await service.check('startup');
        expect(status.availableVersion).toBe('0.0.9');
        expect(service.promptOpen()).toBe(true);
        expect(service.status().verifiedSignature).toBe(false);
        service.later();
        expect(service.promptOpen()).toBe(false);
        expect(service.status().state).toBe('available');
    });

    it('downloads then installs on Update now', async () => {
        updates.download.mockResolvedValue({ state: 'downloaded', canQuitAndInstall: true });
        updates.install.mockResolvedValue({ state: 'downloaded' });
        service.status.set({ state: 'available' });
        await service.updateNow();
        expect(updates.download).toHaveBeenCalled();
        expect(updates.install).toHaveBeenCalled();
    });

    it('installs a previously downloaded update', async () => {
        updates.install.mockResolvedValue({ state: 'downloaded', canQuitAndInstall: true });
        service.status.set({ state: 'downloaded' });
        await service.install();
        expect(updates.install).toHaveBeenCalled();
    });

    it('keeps the prompt for a failed launch check', async () => {
        updates.check.mockResolvedValue({
            state: 'error',
            source: 'startup',
            error: 'Could not reach the update feed. Check the network and try again.'
        });
        await service.check('startup');
        expect(service.promptOpen()).toBe(true);
        expect(service.status().error).toMatch(/network/i);
    });
});

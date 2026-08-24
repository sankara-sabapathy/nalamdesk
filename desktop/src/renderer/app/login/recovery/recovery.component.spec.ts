/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoveryComponent } from './recovery.component';

describe('RecoveryComponent', () => {
    let component: RecoveryComponent;
    let router: { navigate: ReturnType<typeof vi.fn> };
    let authService: { acknowledgeRecoveryCode: ReturnType<typeof vi.fn>; recover: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        router = { navigate: vi.fn() };
        authService = {
            acknowledgeRecoveryCode: vi.fn(),
            recover: vi.fn()
        };
        component = new RecoveryComponent(router as any, authService as any);
    });

    it('keeps the rotated code visible when acknowledgement fails', async () => {
        component.newRecoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        authService.acknowledgeRecoveryCode.mockResolvedValue({ success: false });

        await component.finish();

        expect(component.newRecoveryCode).toBe('AAAA-BBBB-CCCC-DDDD');
        expect(component.error).toContain('Could not confirm');
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('returns to login only after acknowledging a rotated code', async () => {
        component.newRecoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        authService.acknowledgeRecoveryCode.mockResolvedValue({ success: true });

        await component.finish();

        expect(authService.acknowledgeRecoveryCode).toHaveBeenCalledWith('AAAA-BBBB-CCCC-DDDD');
        expect(component.newRecoveryCode).toBe('');
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('returns directly to login when no acknowledgement is pending', async () => {
        await component.finish();

        expect(authService.acknowledgeRecoveryCode).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
});

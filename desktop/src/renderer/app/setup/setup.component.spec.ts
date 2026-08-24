/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupComponent } from './setup.component';

vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));

describe('SetupComponent recovery acknowledgement', () => {
    let component: SetupComponent;
    let authService: { login: ReturnType<typeof vi.fn>; acknowledgeRecoveryCode: ReturnType<typeof vi.fn> };
    let router: { navigate: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        authService = {
            login: vi.fn().mockResolvedValue({ success: true }),
            acknowledgeRecoveryCode: vi.fn()
        };
        router = { navigate: vi.fn() };
        component = new SetupComponent(authService as any, router as any, { run: (fn: () => void) => fn() } as any);
        component.password = 'admin-password';
        component.recoveryCode = 'AAAA-BBBB-CCCC-DDDD';
        vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    });

    it('stays on setup when recovery acknowledgement fails', async () => {
        authService.acknowledgeRecoveryCode.mockResolvedValue({ success: false });

        await component.goToDashboard();

        expect(router.navigate).not.toHaveBeenCalled();
        expect(window.alert).toHaveBeenCalledWith('Could not confirm the recovery code. Please try again.');
    });

    it('opens the dashboard only after acknowledgement succeeds', async () => {
        authService.acknowledgeRecoveryCode.mockResolvedValue({ success: true });

        await component.goToDashboard();

        expect(authService.acknowledgeRecoveryCode).toHaveBeenCalledWith('AAAA-BBBB-CCCC-DDDD');
        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
});

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { VisitListComponent } from './visit-list.component';

vi.mock('../../services/api.service');
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return { ...actual as any, inject: vi.fn() };
});

describe('VisitListComponent layout', () => {
    it('keeps Amount visible at 1024px clinic-laptop width', () => {
        const component = new VisitListComponent({ run: (fn: () => void) => fn() } as any, { navigate: vi.fn() } as any);
        const amount = component.colDefs.find(c => c.field === 'amount_paid');
        expect(amount?.headerName).toBe('Amount');
        expect(amount?.minWidth).toBeGreaterThanOrEqual(110);
        const minSum = component.colDefs.reduce((sum, col) => sum + (col.minWidth || 0), 0);
        // 1024px minus lg sidebar (288) minus page padding (48) minus checkbox (~50)
        expect(minSum).toBeLessThanOrEqual(688);
    });
});

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
        // 1024px − lg sidebar (288) − md:p-6 padding (48) = 688. Visit list sets
        // [multiSelect]="true", which SharedTable maps to string rowSelection
        // 'multiple'. AG Grid 32 only injects the controls column (library
        // maxWidth 50) for object rowSelection / selectionColumnDef — neither
        // is configured — so extra selection width is 0.
        const selectionColumnWidth = 0;
        expect(minSum).toBeLessThanOrEqual(1024 - 288 - 48 - selectionColumnWidth);
    });
});

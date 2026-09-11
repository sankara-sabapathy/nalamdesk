/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogTypeaheadComponent } from './catalog-typeahead.component';

describe('CatalogTypeaheadComponent', () => {
    let component: CatalogTypeaheadComponent;

    beforeEach(() => {
        component = new CatalogTypeaheadComponent();
        component.searchFn = vi.fn().mockResolvedValue([{ id: 1, name: 'Influenza' }]);
        component.createFn = vi.fn().mockResolvedValue({ id: 2, name: 'Viral fever' });
    });

    it('emits a picked catalog row', () => {
        const picked = vi.fn();
        component.picked.subscribe(picked);
        component.pick({ id: 1, name: 'Influenza' });
        expect(component.value).toBe('Influenza');
        expect(picked).toHaveBeenCalledWith({ id: 1, name: 'Influenza' });
        expect(component.open).toBe(false);
    });

    it('adds a new catalog row then selects it', async () => {
        component.value = 'Viral fever';
        const picked = vi.fn();
        component.picked.subscribe(picked);
        await component.addNew();
        expect(component.createFn).toHaveBeenCalledWith('Viral fever');
        expect(picked).toHaveBeenCalledWith({ id: 2, name: 'Viral fever' });
    });

    it('keeps typed text usable when add new fails', async () => {
        component.value = 'Viral fever';
        component.createFn = vi.fn().mockRejectedValue(new Error('DUPLICATE_ACTIVE_NAME'));
        await component.addNew();
        expect(component.value).toBe('Viral fever');
        expect(component.error).toMatch(/already/i);
    });
});

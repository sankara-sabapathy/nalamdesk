/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogSettingsComponent } from './catalog-settings.component';

describe('CatalogSettingsComponent', () => {
    let component: CatalogSettingsComponent;
    let data: { invoke: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        data = {
            invoke: vi.fn().mockImplementation((method: string) => {
                if (method === 'listConditions') return Promise.resolve([{ id: 1, name: 'URI', active: 1 }]);
                if (method === 'listMedicines') return Promise.resolve([{ id: 2, name: 'Paracetamol', active: 1, dosage: '500mg' }]);
                if (method === 'getConditionMedPresets') return Promise.resolve([{ medicine: 'Paracetamol', medicine_id: 2 }]);
                return Promise.resolve({ id: 9, name: 'Influenza' });
            })
        };
        component = new CatalogSettingsComponent(data as any, { run: (fn: () => void) => fn() } as any);
    });

    it('loads catalogs during init', () => {
        const reload = vi.spyOn(component, 'reload').mockResolvedValue();
        component.ngOnInit();
        expect(reload).toHaveBeenCalled();
    });

    it('lists catalogs and saves a new condition', async () => {
        await component.reload();
        expect(component.conditions[0].name).toBe('URI');
        component.newCondition = 'Influenza';
        await component.addCondition();
        expect(data.invoke).toHaveBeenCalledWith('createCondition', { name: 'Influenza' });
        expect(component.newCondition).toBe('');
    });

    it('loads and replaces ordered presets', async () => {
        await component.reload();
        await component.selectCondition({ id: 1, name: 'URI' });
        expect(component.presetLines[0].medicine).toBe('Paracetamol');
        component.addPresetLine();
        await component.savePresets();
        expect(data.invoke).toHaveBeenCalledWith('replaceConditionMedPresets', expect.objectContaining({
            conditionId: 1,
            lines: [
                { medicine: 'Paracetamol', medicine_id: 2 },
                expect.objectContaining({ medicine_id: null })
            ]
        }));
    });

    it('shows a plain error for duplicate active names', async () => {
        data.invoke.mockImplementation((method: string) => {
            if (method.startsWith('list')) return Promise.resolve([]);
            return Promise.reject(new Error('DUPLICATE_ACTIVE_NAME'));
        });
        component.newMedicine = 'Paracetamol';
        await component.addMedicine();
        expect(component.success).toBe(false);
        expect(component.message).toMatch(/already exists/i);
    });

    it('does not hide condition presets when a medicine with the same id is retired', async () => {
        await component.reload();
        await component.selectCondition({ id: 1, name: 'URI' });
        await component.retire('retireMedicine', { id: 1, name: 'Old syrup' });
        expect(component.selectedCondition).toEqual({ id: 1, name: 'URI' });
        await component.retire('retireCondition', { id: 1, name: 'URI' });
        expect(component.selectedCondition).toBeNull();
    });

    it('saves medicine rows, preset lines, and catalog errors', async () => {
        await component.reload();
        await component.selectCondition({ id: 1, name: 'URI' });
        component.onPresetMedicine(0);
        component.addPresetLine();
        component.removePreset(1);
        await component.saveCondition({ id: 1, name: 'URI' });
        await component.saveMedicine({ id: 2, name: 'Paracetamol', dosage: '500mg' });
        component.newMedicine = 'Cetirizine';
        await component.addMedicine();
        expect(data.invoke).toHaveBeenCalledWith('updateCondition', { id: 1, name: 'URI' });
        expect(data.invoke).toHaveBeenCalledWith('createMedicine', { name: 'Cetirizine' });

        data.invoke.mockRejectedValueOnce(new Error('NAME_REQUIRED'));
        component.newCondition = '';
        await component.addCondition();
        expect(component.message).toMatch(/required/i);
    });
});

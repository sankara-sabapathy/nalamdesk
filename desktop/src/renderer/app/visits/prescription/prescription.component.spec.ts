/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrescriptionComponent } from './prescription.component';

// Mock inject for standalone components
vi.mock('@angular/core', async () => {
    const actual = await vi.importActual('@angular/core');
    return {
        ...actual as any,
        inject: vi.fn(),
    };
});

describe('PrescriptionComponent', () => {
    let component: PrescriptionComponent;

    beforeEach(() => {
        component = new PrescriptionComponent();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with default item', () => {
        const items = component.items();
        expect(items.length).toBe(1);
        expect(items[0].medicine).toBe('');
    });

    it('should add medicine item', () => {
        vi.spyOn(component.changed, 'emit');
        component.add();
        expect(component.items().length).toBe(2);
        expect(component.changed.emit).toHaveBeenCalled();
    });

    it('should remove medicine item', () => {
        vi.spyOn(component.changed, 'emit');
        component.add(); // Now 2
        component.remove(0); // Remove first
        expect(component.items().length).toBe(1);
        expect(component.changed.emit).toHaveBeenCalledTimes(2); // Add + Remove
    });

    it('should emit changes when updated manually', () => {
        vi.spyOn(component.changed, 'emit');
        // Simulate ngModel change calling emitChange
        component.emitChange();
        expect(component.changed.emit).toHaveBeenCalledWith(component.items());
    });

    it('should set initial data', () => {
        const data = [{ medicine: 'Paracetamol', form: 'Tab' }];
        component.initialData = data;
        expect(component.items()).toEqual(data);
    });
});

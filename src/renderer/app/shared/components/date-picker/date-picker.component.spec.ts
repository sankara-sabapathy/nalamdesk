/**
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatePickerComponent } from './date-picker.component';
import { ElementRef } from '@angular/core';

describe('DatePickerComponent', () => {
    let component: DatePickerComponent;
    let mockElementRef: any;

    beforeEach(() => {
        mockElementRef = {
            nativeElement: {
                contains: vi.fn(),
                isConnected: true
            }
        };
        component = new DatePickerComponent(mockElementRef);
        // Simulate ngOnInit
        component.ngOnInit();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should generate years based on min/max date', () => {
        const currentYear = new Date().getFullYear();
        // Default: currentYear to currentYear - 110
        expect(component.years.length).toBeGreaterThan(100);
        expect(component.years[0]).toBe(currentYear);
    });

    it('should select year and move to MONTH view', () => {
        component.selectYear(2000);
        expect(component.selectedYear).toBe(2000);
        expect(component.view).toBe('MONTH');
    });

    it('should select month and move to DAY view', () => {
        component.selectedYear = 2000;
        component.selectMonth(0); // Jan
        expect(component.selectedMonth).toBe(0);
        expect(component.view).toBe('DAY');
        expect(component.daysInMonth.length).toBe(31);
    });

    it('should select day and update value', () => {
        const onChangeSpy = vi.fn();
        component.registerOnChange(onChangeSpy);

        component.selectedYear = 2000;
        component.selectedMonth = 0; // Jan
        component.selectDay(15);

        expect(component.value).toBe('2000-01-15');
        expect(onChangeSpy).toHaveBeenCalledWith('2000-01-15');
        expect(component.isOpen).toBe(false);
    });

    it('should parse manual input (DDMMYYYY)', () => {
        const inputEvent = { target: { value: '25122000' } } as any;
        const onChangeSpy = vi.fn();
        component.registerOnChange(onChangeSpy);

        component.onInput(inputEvent);

        expect(component.value).toBe('2000-12-25');
        expect(onChangeSpy).toHaveBeenCalledWith('2000-12-25');
    });

    it('should parse manual input (DD/MM/YYYY)', () => {
        const inputEvent = { target: { value: '25/12/2000' } } as any;
        const onChangeSpy = vi.fn();
        component.registerOnChange(onChangeSpy);

        component.onInput(inputEvent);

        expect(component.value).toBe('2000-12-25');
    });

    it('should not update value for invalid date', () => {
        const inputEvent = { target: { value: '99999999' } } as any; // Invalid month/day
        const onChangeSpy = vi.fn();
        component.registerOnChange(onChangeSpy);

        component.onInput(inputEvent);

        expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it('should respect minDate validation', () => {
        component.minDate = '2020-01-01';
        component.selectedYear = 2019;
        component.selectedMonth = 0;

        // 2019-01-01 is before 2020-01-01
        expect(component.isDateDisabled(1)).toBe(true);
    });

    it('should handle global click (close if outside)', () => {
        component.isOpen = true;
        const div = document.createElement('div');
        // Mock isConnected
        Object.defineProperty(div, 'isConnected', { value: true });

        const event = { target: div } as any;
        mockElementRef.nativeElement.contains.mockReturnValue(false);

        component.onGlobalClick(event);

        expect(component.isOpen).toBe(false);
    });

    it('should handle global click (stay open if inside)', () => {
        component.isOpen = true;
        const div = document.createElement('div');
        // Mock isConnected
        Object.defineProperty(div, 'isConnected', { value: true });

        const event = { target: div } as any;
        mockElementRef.nativeElement.contains.mockReturnValue(true);

        component.onGlobalClick(event);

        expect(component.isOpen).toBe(true);
    });
});

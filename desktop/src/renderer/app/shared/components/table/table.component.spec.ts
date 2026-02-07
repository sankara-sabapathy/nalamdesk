import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTableComponent } from './table.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, Input, ElementRef, NgZone } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';

// Mock AgGridAngular
@Component({
    selector: 'ag-grid-angular',
    template: '<div></div>',
    standalone: true
})
class MockAgGridAngular {
    @Input() rowData: any;
    @Input() columnDefs: any;
    @Input() defaultColDef: any;
    @Input() theme: any;
    @Input() paginationPageSize: any;
    @Input() paginationPageSizeSelector: any;
    @Input() rowSelection: any;
    @Input() rowHeight: any;
    @Input() overlayNoRowsTemplate: any;
    @Input() animateRows: any;
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('SharedTableComponent', () => {
    let component: SharedTableComponent;
    let fixture: ComponentFixture<SharedTableComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SharedTableComponent],
            providers: [
                { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
                // NgZone is usually required
                { provide: NgZone, useValue: { run: (fn: any) => fn() } }
            ]
        })
            .overrideComponent(SharedTableComponent, {
                remove: { imports: [AgGridAngular] },
                add: { imports: [MockAgGridAngular] }
            })
            .compileComponents();

        fixture = TestBed.createComponent(SharedTableComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have correct default column definitions for wrapping', () => {
        const defaults = component.defaultColDef;
        expect(defaults.wrapText).toBe(true);
        expect(defaults.autoHeight).toBe(true);
        expect(defaults.wrapHeaderText).toBe(false); // Critical fix verification
        expect(defaults.autoHeaderHeight).toBe(false);
        expect(defaults.minWidth).toBe(150);
    });

    it('should set row selection configuration correctly', () => {
        component.multiSelect = true;
        const config = component.rowSelectionConfig;
        expect(config.mode).toBe('multiRow');
        expect(config.checkboxes).toBe(true);
        expect(config.headerCheckbox).toBe(true);
    });
});

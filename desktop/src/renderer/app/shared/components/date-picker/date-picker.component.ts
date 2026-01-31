import { Component, forwardRef, Input, OnInit, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'app-date-picker',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="relative w-full">
      
      <!-- Input Field -->
      <!-- Input Field -->
      <div class="relative group">
        <input 
          type="text" 
          [value]="displayValue" 
          (input)="onInput($event)"
          (focus)="togglePicker()"
          placeholder="{{ placeholder }}"
          class="w-full border p-2 pl-10 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-700 font-medium"
          [class.border-red-500]="hasError"
        >
        <span class="absolute left-3 top-2.5 text-gray-400 cursor-pointer" (click)="togglePicker()">📅</span>
        <span *ngIf="value" (click)="clear($event)" class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer">✕</span>
      </div>

      <!-- Helper Text -->
      <p class="text-[10px] text-gray-500 mt-1" *ngIf="helperText">{{ helperText }}</p>

      <!-- Picker Dropdown -->
      <div *ngIf="isOpen" class="absolute z-50 mt-1 w-[320px] bg-white rounded-lg shadow-xl border border-gray-200 p-4">
        
        <!-- Header / Back Navigation -->
        <div class="flex justify-between items-center mb-4">
            <button *ngIf="view !== 'YEAR'" (click)="goBack()" class="text-sm font-bold text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">
                ← Back
            </button>
            <span class="font-bold text-lg text-blue-600">
                {{ getTitle() }}
            </span>
            <button (click)="close()" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <!-- 1. YEAR VIEW (Horizontal Scroll) -->
        <div *ngIf="view === 'YEAR'" class="text-center">
            <p class="text-xs text-gray-500 mb-2">Select Year</p>
            <div class="flex flex-wrap gap-2 justify-center max-h-[250px] overflow-y-auto custom-scrollbar">
               <button *ngFor="let year of years" 
                       (click)="selectYear(year)"
                       class="px-4 py-2 rounded-full border text-sm font-medium hover:bg-blue-50 hover:border-blue-500 transition-colors"
                       [class.bg-blue-600]="year === selectedYear"
                       [class.text-white]="year === selectedYear"
                       [class.border-blue-600]="year === selectedYear"
                       [class.bg-white]="year !== selectedYear"
                       [class.text-gray-700]="year !== selectedYear">
                   {{ year }}
               </button>
            </div>
        </div>

        <!-- 2. MONTH VIEW -->
        <div *ngIf="view === 'MONTH'" class="text-center">
            <p class="text-xs text-gray-500 mb-2">Select Month ({{ selectedYear || '' }})</p>
            <div class="grid grid-cols-3 gap-3">
                <button *ngFor="let month of months; let i = index" 
                        (click)="selectMonth(i)"
                        class="p-3 rounded border text-sm font-medium hover:bg-blue-50 hover:border-blue-500 transition-colors"
                        [class.bg-blue-600]="selectedMonth === i"
                        [class.text-white]="selectedMonth === i">
                    {{ month }}
                </button>
            </div>
        </div>

        <!-- 3. DAY VIEW -->
        <div *ngIf="view === 'DAY'" class="text-center">
            <p class="text-xs text-gray-500 mb-2">Select Date ({{ getMonthName() }} {{ selectedYear }})</p>
            
            <!-- Weekdays -->
            <div class="grid grid-cols-7 mb-2 text-xs font-bold text-gray-400">
                <span *ngFor="let d of weekDays">{{ d }}</span>
            </div>

            <!-- Days -->
            <div class="grid grid-cols-7 gap-1">
                <!-- Empty slots -->
                <span *ngFor="let empty of emptyDays"></span>
                
                <!-- Actual Days -->
                <button *ngFor="let day of daysInMonth" 
                        (click)="selectDay(day)"
                        [disabled]="isDateDisabled(day)"
                        class="w-8 h-8 rounded-full text-sm flex items-center justify-center hover:bg-blue-100 transition-colors mx-auto"
                        [class.bg-blue-600]="isSameDate(day)"
                        [class.text-white]="isSameDate(day)"
                        [class.text-gray-700]="!isSameDate(day) && !isDateDisabled(day)"
                        [class.text-gray-300]="isDateDisabled(day)"
                        [class.cursor-not-allowed]="isDateDisabled(day)">
                    {{ day }}
                </button>
            </div>
        </div>

      </div>
    </div>
  `,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DatePickerComponent),
            multi: true
        }
    ]
})
export class DatePickerComponent implements ControlValueAccessor, OnInit {
    @Input() placeholder = 'Select Date';
    @Input() helperText = '';
    @Input() minDate?: string;
    @Input() maxDate?: string;
    @Input() hasError = false;

    value: string | null = null;
    displayValue = '';
    isOpen = false;
    view: 'YEAR' | 'MONTH' | 'DAY' = 'YEAR';

    // Selection State
    selectedYear: number | null = null;
    selectedMonth: number | null = null; // 0-11

    // Data
    years: number[] = [];
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    daysInMonth: number[] = [];
    emptyDays: any[] = [];

    onChange: any = () => { };
    onTouched: any = () => { };

    constructor(private el: ElementRef) { }

    ngOnInit() {
        this.generateYears();
    }

    generateYears() {
        const currentYear = new Date().getFullYear();
        const minYear = this.minDate ? new Date(this.minDate).getFullYear() : currentYear - 110;
        const maxYear = this.maxDate ? new Date(this.maxDate).getFullYear() : currentYear;

        // Generate years in descending order (newest first)
        this.years = [];
        for (let y = maxYear; y >= minYear; y--) {
            this.years.push(y);
        }
    }

    // Value Accessor
    writeValue(value: string): void {
        this.value = value;
        this.updateDisplay();
        if (value) {
            const d = new Date(value);
            this.selectedYear = d.getFullYear();
            this.selectedMonth = d.getMonth();
        }
    }
    registerOnChange(fn: any): void { this.onChange = fn; }
    registerOnTouched(fn: any): void { this.onTouched = fn; }

    togglePicker() {
        if (!this.isOpen) {
            this.isOpen = true;
            this.view = 'YEAR'; // Always restart flow? Or keep state? "Guide user" implies restarting flow might be good, or at least ensuring they pick year.
            // If value exists, maybe start at day view? 
            // User request: "guide user to start with year month and date in order"
            // So let's stick to YEAR view on open, unless they are just editing. 
            // Actually, if they want to edit, they might want to just change day.
            // Let's check if value is set.
            if (this.value) {
                const d = new Date(this.value);
                this.selectedYear = d.getFullYear();
                this.selectedMonth = d.getMonth();
                this.view = 'DAY'; // If exists, show day. logic: ease of edit.
                this.generateDays();
            } else {
                this.view = 'YEAR'; // Start fresh
            }
        } else {
            // close
            this.isOpen = false;
        }
        this.onTouched();
    }

    close() {
        this.isOpen = false;
    }

    // Flow Logic
    selectYear(year: number) {
        this.selectedYear = year;
        this.view = 'MONTH';
    }

    selectMonth(monthIndex: number) {
        this.selectedMonth = monthIndex;
        this.view = 'DAY';
        this.generateDays();
    }

    selectDay(day: number) {
        if (!this.selectedYear || this.selectedMonth === null) return;

        // Construct Date String YYYY-MM-DD
        // Note: Month is 0-indexed
        const date = new Date(this.selectedYear, this.selectedMonth, day);
        // Adjust for timezone offset to get strictly the date selected
        // Or just simple string formatting since we want YYYY-MM-DD local
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        const isoDate = `${y}-${m}-${d}`;

        this.value = isoDate;
        this.updateDisplay();
        this.onChange(this.value);
        this.isOpen = false;
    }

    // Helpers
    getTitle() {
        if (this.view === 'YEAR') return 'Select Year';
        if (this.view === 'MONTH') return `${this.selectedYear}`;
        if (this.view === 'DAY') return `${this.getMonthName()} ${this.selectedYear}`;
        return '';
    }

    getMonthName() {
        if (this.selectedMonth === null) return '';
        return this.months[this.selectedMonth];
    }

    goBack() {
        if (this.view === 'DAY') this.view = 'MONTH';
        else if (this.view === 'MONTH') this.view = 'YEAR';
    }

    generateDays() {
        if (!this.selectedYear || this.selectedMonth === null) return;
        const daysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
        const firstDayIndex = new Date(this.selectedYear, this.selectedMonth, 1).getDay(); // 0 = Sun

        this.daysInMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        this.emptyDays = Array(firstDayIndex).fill(0);
    }

    updateDisplay() {
        if (!this.value) {
            this.displayValue = '';
            return;
        }
        const [y, m, d] = this.value.split('-');
        // Format: DD/MM/YYYY
        this.displayValue = `${d}/${m}/${y}`;
    }

    isSameDate(day: number) {
        if (!this.value) return false;
        const [y, m, d] = this.value.split('-').map(Number);
        return this.selectedYear === y && (this.selectedMonth! + 1) === m && day === d;
    }

    isDateDisabled(day: number) {
        if (!this.selectedYear || this.selectedMonth === null) return false;
        const dateStr = `${this.selectedYear}-${(this.selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        if (this.minDate && dateStr < this.minDate) return true;
        if (this.maxDate && dateStr > this.maxDate) return true;
        return false;
    }

    clear(e: Event) {
        e.stopPropagation();
        this.value = null;
        this.selectedYear = null;
        this.selectedMonth = null;
        this.displayValue = '';
        this.onChange(null);
        this.view = 'YEAR';
    }

    onInput(event: Event) {
        const input = event.target as HTMLInputElement;
        let val = input.value;

        // Auto-open if typing
        if (!this.isOpen) this.isOpen = true;

        // Simple Masking / Parsing logic could go here. 
        // For now, let's just let them type and try to parse valid dates.
        // Format expected: DD/MM/YYYY or YYYY-MM-DD

        // flexible parser
        // Try D/M/Y
        const dmy = val.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (dmy) {
            const d = parseInt(dmy[1]);
            const m = parseInt(dmy[2]) - 1;
            const y = parseInt(dmy[3]);
            this.setDateFromInput(y, m, d);
            return;
        }

        // Try Y-M-D
        const ymd = val.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (ymd) {
            const y = parseInt(ymd[1]);
            const m = parseInt(ymd[2]) - 1;
            const d = parseInt(ymd[3]);
            this.setDateFromInput(y, m, d);
            return;
        }

        // If simply numbers 01012000 (8 digits) -> DDMMYYYY
        if (val.match(/^\d{8}$/)) {
            const d = parseInt(val.substring(0, 2));
            const m = parseInt(val.substring(2, 4)) - 1;
            const y = parseInt(val.substring(4, 8));
            this.setDateFromInput(y, m, d);
        }
    }

    setDateFromInput(y: number, m: number, d: number) {
        const date = new Date(y, m, d);
        if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
            this.selectedYear = y;
            this.selectedMonth = m;

            // Check bounds
            if (this.isDateDisabled(d)) return;

            const iso = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            this.value = iso;
            this.onChange(this.value);
            // Don't close while typing, maybe? Or close if valid? 
            // Let's keep open strictly, unless they blur.
        }
    }

    @HostListener('document:click', ['$event'])
    onClickOutside(event: Event) {
        // If element is removed from DOM (like year button after click), container check fails.
        // We need to check if the target is still in document usually, but simpler:
        // Use a flag during generic interactions? 
        // Or just realize that if we are clicking INSIDE, we explicitly handle it.
        // The issue is the event bubbles to document. 
        // We can stopPropagation on the component click?
    }

    // Better approach: Listen on window, but stop propagation on local clicks?
    // Angular HostListener captures inside too.
    // Let's use ElementRef check but verify target connectivity.
    @HostListener('document:mousedown', ['$event'])
    onGlobalClick(event: MouseEvent) {
        if (!this.isOpen) return;
        const target = event.target as HTMLElement;

        // If click is inside our component
        if (this.el.nativeElement.contains(target)) {
            return;
        }

        // If target was removed from DOM (e.g. *ngIf switch), we might be closing incorrectly.
        // Standard fix: check if target is connected.
        if (!target.isConnected) {
            return;
        }

        this.isOpen = false;
        // On close, validate text?
    }
}

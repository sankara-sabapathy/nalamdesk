import { Component, EventEmitter, Input, Output, HostListener, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
    selector: 'app-universal-dialog',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6"
         role="dialog" aria-modal="true" aria-labelledby="modal-title">
      
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
           (click)="onBackdropClick()"
           [class.opacity-0]="!animateIn"
           [class.opacity-100]="animateIn"></div>

      <!-- Dialog Panel -->
      <div class="relative w-full transform rounded-2xl bg-base-100/90 p-6 text-left shadow-2xl ring-1 ring-white/10 backdrop-blur-md transition-all sm:my-8 sm:w-full sm:max-w-lg"
           [class.scale-95]="!animateIn"
           [class.opacity-0]="!animateIn"
           [class.scale-100]="animateIn"
           [class.opacity-100]="animateIn">
           
        <!-- Close Button (Absolute Top Right) -->
        <button type="button" 
                class="absolute right-4 top-4 rounded-full p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content transition-colors focus:outline-none"
                (click)="close()">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Header / Icon -->
        <div class="mb-5 flex flex-col items-center sm:items-start">
           <div *ngIf="icon" class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 sm:mx-0 sm:h-10 sm:w-10 mb-4 sm:mb-0">
             <!-- Icon Projection or generic icon -->
             <ng-content select="[icon]"></ng-content>
             <svg *ngIf="!hasIconContent" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
             </svg>
           </div>
           
           <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
             <h3 class="text-xl font-bold leading-6 text-base-content font-display" id="modal-title">
               {{ title }}
             </h3>
             <div class="mt-2">
               <p class="text-sm text-base-content/70">
                 <ng-content select="[body]"></ng-content>
                 {{ message }}
               </p>
               <!-- Default Content Area if no selector used -->
               <ng-content></ng-content> 
             </div>
           </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
           <ng-content select="[actions]"></ng-content>
           <!-- Default Close Action if no actions provided -->
           <button *ngIf="!hasActionsContent" type="button" 
                   class="btn btn-primary w-full sm:w-auto"
                   (click)="close()">
             OK
           </button>
        </div>
        
        <!-- Decorative Elements/Gradients for Premium feel -->
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>

      </div>
    </div>
  `,
    styles: [`
    :host { display: block; }
    .font-display { font-family: 'Outfit', sans-serif; /* Example premium font if avail */ }
  `]
})
export class UniversalDialogComponent implements OnChanges {
    @Input() title: string = 'Notification';
    @Input() message: string = '';
    @Input() isOpen: boolean = false;
    @Input() icon: boolean = true;

    @Output() isOpenChange = new EventEmitter<boolean>();
    @Output() confirm = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    animateIn = false;
    hasIconContent = false; // logic to detect if icon projected could be added
    hasActionsContent = false; // logic to detect if actions projected

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen']) {
            if (this.isOpen) {
                // Slight delay to allow DOM render then animate opacity
                setTimeout(() => this.animateIn = true, 10);
            } else {
                this.animateIn = false;
            }
        }
    }

    close() {
        this.animateIn = false;
        setTimeout(() => {
            this.isOpen = false;
            this.isOpenChange.emit(false);
            this.cancel.emit();
        }, 200); // Wait for transition
    }

    onBackdropClick() {
        this.close();
    }

    onConfirm() {
        this.confirm.emit();
        this.close();
    }
}

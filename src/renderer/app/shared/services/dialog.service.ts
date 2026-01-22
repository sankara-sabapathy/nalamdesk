import { Injectable, signal, computed } from '@angular/core';

export interface DialogOptions {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
    confirmText?: string;
    cancelText?: string;
    icon?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class DialogService {
    private _isOpen = signal(false);
    private _options = signal<DialogOptions>({ title: '', message: '' });

    // Expose read-only signals
    isOpen = this._isOpen.asReadonly();
    options = this._options.asReadonly();

    private resolveRef: ((result: boolean) => void) | null = null;

    /**
     * Opens the universal dialog and returns a promise that resolves 
     * to true if confirmed, false if cancelled/closed.
     */
    open(opts: DialogOptions): Promise<boolean> {
        this._options.set({
            icon: true,
            confirmText: 'OK',
            cancelText: 'Cancel',
            type: 'info',
            ...opts
        });
        this._isOpen.set(true);

        return new Promise<boolean>((resolve) => {
            this.resolveRef = resolve;
        });
    }

    confirm() {
        this._isOpen.set(false);
        if (this.resolveRef) {
            this.resolveRef(true);
            this.resolveRef = null;
        }
    }

    close() {
        this._isOpen.set(false);
        if (this.resolveRef) {
            this.resolveRef(false);
            this.resolveRef = null;
        }
    }
}

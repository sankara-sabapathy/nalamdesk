import { AfterViewChecked, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUpdateService } from '../../../services/update.service';

@Component({
    selector: 'app-update-prompt',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="showPrompt" class="fixed inset-0 z-[110] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="update-prompt-title"
         (keydown)="onPromptKeydown($event)">
      <div class="fixed inset-0 bg-black/50" (click)="later()"></div>
      <div class="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-gray-200">
        <h3 id="update-prompt-title" tabindex="-1" class="text-xl font-bold text-gray-900">{{ title }}</h3>
        <p class="mt-2 text-sm text-gray-700 whitespace-pre-line">{{ body }}</p>
        <p *ngIf="status.integrityNote && status.state !== 'error'" class="mt-3 text-xs text-gray-500">{{ status.integrityNote }}</p>
        <div *ngIf="status.state === 'downloading'" class="mt-4">
          <div class="h-2 rounded bg-gray-200 overflow-hidden">
            <div class="h-full bg-blue-600" [style.width.%]="status.percent || 0"></div>
          </div>
          <p class="text-xs text-gray-500 mt-1">{{ status.percent || 0 }}%</p>
        </div>
        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button *ngIf="status.state === 'downloading'" type="button"
                  class="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  (click)="cancel()">Cancel</button>
          <button *ngIf="status.state === 'available' || status.state === 'downloaded'" type="button"
                  class="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  (click)="later()">Later</button>
          <button *ngIf="status.state === 'available'" type="button" id="update-prompt-primary"
                  class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
                  (click)="updateNow()">{{ status.canQuitAndInstall === false ? 'Open download page' : 'Update now' }}</button>
          <button *ngIf="status.state === 'downloaded'" type="button" id="update-prompt-primary"
                  class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
                  (click)="install()">{{ status.canQuitAndInstall === false ? 'Open download page' : 'Install and restart' }}</button>
          <button *ngIf="status.state === 'error' || status.state === 'up-to-date' || status.state === 'skipped'" type="button"
                  id="update-prompt-primary"
                  class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
                  (click)="later()">OK</button>
        </div>
      </div>
    </div>
  `
})
export class UpdatePromptComponent implements OnInit, OnDestroy, AfterViewChecked {
    private readonly updates = inject(AppUpdateService);
    private previousFocus: HTMLElement | null = null;
    private promptFocused = false;

    ngOnInit(): void {
        this.updates.init();
    }

    ngOnDestroy(): void {
        this.updates.destroy();
    }

    ngAfterViewChecked(): void {
        if (!this.showPrompt) {
            this.restoreFocus();
            return;
        }
        if (this.promptFocused) return;
        this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const target = document.getElementById('update-prompt-primary') || document.getElementById('update-prompt-title');
        target?.focus();
        this.promptFocused = true;
    }

    get status() {
        return this.updates.status();
    }

    get showPrompt(): boolean {
        return this.updates.promptOpen();
    }

    get title(): string {
        if (this.status.state === 'error') return 'Update failed';
        if (this.status.state === 'up-to-date') return 'You’re up to date';
        if (this.status.state === 'skipped') return 'Updates';
        if (this.status.state === 'downloading') return 'Downloading update';
        if (this.status.state === 'downloaded') return 'Update downloaded';
        return 'Update available';
    }

    get body(): string {
        if (this.status.state === 'error') {
            return this.status.error || 'Update failed.';
        }
        if (this.status.state === 'up-to-date') {
            return `This app is ${this.status.currentVersion || 'current'}.`;
        }
        if (this.status.state === 'skipped') {
            if (this.status.reason === 'unpackaged') return 'In-app updates run only in a packaged desktop build.';
            return 'No update feed is configured on this device.';
        }
        const notes = this.status.releaseNotes ? `\n\n${this.status.releaseNotes}` : '';
        return `Current version: ${this.status.currentVersion || 'unknown'}\nNew version: ${this.status.availableVersion || 'unknown'}${notes}`;
    }

    later(): void {
        this.updates.later();
        this.restoreFocus();
    }

    updateNow(): void {
        this.updates.updateNow();
    }

    install(): void {
        this.updates.install();
    }

    cancel(): void {
        this.updates.cancelDownload();
    }

    onPromptKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.later();
            return;
        }
        if (event.key !== 'Tab') return;
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(
            '[role="dialog"][aria-modal="true"] button:not([disabled])'
        ));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    private restoreFocus(): void {
        if (!this.promptFocused) return;
        this.promptFocused = false;
        this.previousFocus?.focus();
        this.previousFocus = null;
    }
}

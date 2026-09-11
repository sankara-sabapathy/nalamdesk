import { Injectable, NgZone, signal } from '@angular/core';

export interface AppUpdateStatus {
    state: string;
    source?: 'startup' | 'manual';
    reason?: string;
    currentVersion?: string;
    availableVersion?: string;
    releaseNotes?: string;
    percent?: number;
    error?: string;
    applyMode?: string;
    canQuitAndInstall?: boolean;
    downloadPageUrl?: string;
    verifiedSignature?: boolean;
    integrityNote?: string;
    packaged?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
    readonly status = signal<AppUpdateStatus>({ state: 'idle' });
    readonly promptOpen = signal(false);
    private unsubscribe: (() => void) | null = null;
    private started = false;

    constructor(private readonly ngZone: NgZone) { }

    init(): void {
        if (this.started) return;
        this.started = true;
        const api = (globalThis as any).electron?.updates;
        if (!api) return;
        this.unsubscribe = api.onEvent((status: AppUpdateStatus) => {
            this.ngZone.run(() => this.applyStatus(status));
        });
        this.checkStartup().catch(() => undefined);
    }

    destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    async check(source: 'startup' | 'manual' = 'manual'): Promise<AppUpdateStatus> {
        const api = (globalThis as any).electron?.updates;
        if (!api) return this.status();
        const status = await api.check({ source });
        this.applyStatus(status);
        return status;
    }

    async updateNow(): Promise<void> {
        const api = (globalThis as any).electron?.updates;
        if (!api) return;
        const afterDownload = await api.download();
        this.applyStatus(afterDownload);
        if (afterDownload.state === 'downloaded') {
            await this.install();
        }
    }

    async install(): Promise<void> {
        const api = (globalThis as any).electron?.updates;
        if (!api) return;
        const status = await api.install();
        this.applyStatus(status);
    }

    later(): void {
        this.promptOpen.set(false);
    }

    async cancelDownload(): Promise<void> {
        const api = (globalThis as any).electron?.updates;
        if (!api) return;
        const status = await api.cancel();
        this.applyStatus(status);
    }

    private async checkStartup(): Promise<void> {
        try {
            const info = await (globalThis as any).electron?.getAppVersion?.();
            if (!info?.packaged) return;
            await this.check('startup');
        } catch {
            // Launch check is best-effort; the running app stays usable.
        }
    }

    private applyStatus(status: AppUpdateStatus): void {
        this.status.set(status || { state: 'idle' });
        const state = status?.state;
        const manual = status?.source === 'manual';
        const shouldPrompt = state === 'available'
            || state === 'downloading'
            || state === 'downloaded'
            || state === 'error'
            || (manual && (state === 'up-to-date' || state === 'skipped'));
        if (shouldPrompt) this.promptOpen.set(true);
    }
}

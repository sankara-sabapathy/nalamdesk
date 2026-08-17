import { Injectable } from '@angular/core';

export interface RuntimeInfo {
    localIp: string;
    apiPort: number;
    isDev: boolean;
    appName: string;
}

@Injectable({
    providedIn: 'root'
})
export class RuntimeService {
    localIp = '';
    apiPort = 3000;
    isDev = false;
    appName = 'NalamDesk';
    private initPromise: Promise<void> | null = null;

    init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.loadRuntimeInfo();
        }
        return this.initPromise;
    }

    get lanAccessUrl(): string {
        if (!this.localIp) {
            return '';
        }
        return `http://${this.localIp}:${this.apiPort}`;
    }

    private async loadRuntimeInfo(): Promise<void> {
        const electron = (globalThis as { electron?: { utils?: { getRuntimeInfo?: () => Promise<RuntimeInfo> } } }).electron;
        if (!electron?.utils?.getRuntimeInfo) {
            return;
        }

        try {
            const info = await electron.utils.getRuntimeInfo();
            this.localIp = info.localIp;
            this.apiPort = info.apiPort;
            this.isDev = info.isDev;
            this.appName = info.appName;
        } catch (e) {
            console.error('[RuntimeService] Failed to load runtime info', e);
        }
    }
}

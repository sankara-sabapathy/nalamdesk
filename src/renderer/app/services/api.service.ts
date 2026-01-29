import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class DataService {

    constructor(private auth: AuthService) { }

    async invoke<T = any>(method: string, ...args: any[]): Promise<T> {
        if (window.electron) {
            // Local IPC
            const db = (window.electron.db as any);
            const cloud = (window.electron.cloud as any);

            if (db && db[method]) {
                return await db[method](...args);
            } else if (method.startsWith('cloud:') && cloud) {
                // Remove 'cloud:' prefix if necessary, but our preload maps methods directly without prefix usually? 
                // Wait, preload has 'cloud.syncNow', 'cloud.publishSlots'. Renderer calls 'cloud:syncNow'.
                // We need to map 'cloud:syncNow' -> electron.cloud.syncNow
                const pureMethod = method.replace('cloud:', '');
                if (cloud[pureMethod]) {
                    return await cloud[pureMethod](...args);
                }
            }

            // Fallback or error
            console.error(`Method ${method} not found in local bridge`);
            throw new Error(`Method ${method} not implemented locally`);
        } else {
            // Remote HTTP
            const token = this.auth.getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(`/api/ipc/${method}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(args)
            });

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new Error(data?.error || data || 'Server Error');
            }

            return data;
        }
    }
}

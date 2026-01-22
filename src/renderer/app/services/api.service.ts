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
            if (db[method]) {
                return await db[method](...args);
            } else {
                console.error(`Method ${method} not found in window.electron.db`);
                throw new Error(`Method ${method} not implemented locally`);
            }
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

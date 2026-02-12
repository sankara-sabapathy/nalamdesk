import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class DataService {

    constructor(private auth: AuthService) { }

    async invoke<T = any>(method: string, ...args: any[]): Promise<T> {
        if (window.electron) {
            return this.invokeLocal<T>(method, args);
        }
        return this.invokeRemote<T>(method, args);
    }

    private async invokeLocal<T>(method: string, args: any[]): Promise<T> {
        const db = (window.electron.db as any);
        const cloud = (window.electron.cloud as any);

        if (db && db[method]) {
            return await db[method](...args);
        }

        if (method.startsWith('cloud:') && cloud) {
            const pureMethod = method.replace('cloud:', '');
            if (cloud[pureMethod]) {
                return await cloud[pureMethod](...args);
            }
        }

        console.error(`Method ${method} not found in local bridge`);
        throw new Error(`Method ${method} not implemented locally`);
    }

    private async invokeRemote<T>(method: string, args: any[]): Promise<T> {
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

        const data = await this.parseResponse(response);

        if (!response.ok) {
            throw new Error(data?.error || data || 'Server Error');
        }

        return data;
    }

    private async parseResponse(response: Response): Promise<any> {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }
}

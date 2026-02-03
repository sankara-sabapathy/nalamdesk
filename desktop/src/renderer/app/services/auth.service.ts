import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private tokenKey = 'nalamdesk_token';
    private userKey = 'nalamdesk_user';

    constructor() { }

    async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
        if (window.electron) {
            try {
                const result = await window.electron.login({ username, password });
                if (result.success) {
                    this.setUser(result.user);
                    return { success: true };
                } else {
                    return { success: false, error: result.error };
                }
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        } else {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    this.setToken(data.token);
                    this.setUser(data.user);
                    return { success: true };
                } else {
                    return { success: false, error: data.error };
                }
            } catch (e: any) {
                return { success: false, error: 'Network Error' };
            }
        }
    }

    async checkSetup(): Promise<{ isSetup: boolean, hasRecovery: boolean }> {
        if (window.electron) {
            return await window.electron.checkSetup();
        } else {
            // Web: Check API
            // For now assume true or implement API endpoint
            return { isSetup: true, hasRecovery: false };
        }
    }

    async setup(data: any): Promise<{ success: boolean, recoveryCode?: string, error?: string }> {
        if (window.electron) {
            return await window.electron.setup(data);
        }
        return { success: false, error: 'Web setup not supported yet' };
    }

    async recover(data: any): Promise<{ success: boolean, recoveryCode?: string, error?: string }> {
        if (window.electron) {
            return await window.electron.recover(data);
        }
        return { success: false, error: 'Web recovery not supported yet' };
    }

    async regenerateRecoveryCode(password: string): Promise<{ success: boolean, recoveryCode?: string, error?: string }> {
        if (window.electron) {
            return await window.electron.regenerateRecoveryCode(password);
        }
        return { success: false, error: 'Not supported' };
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        window.location.reload();
    }

    getUser() {
        const u = localStorage.getItem(this.userKey);
        return u ? JSON.parse(u) : null;
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    private setUser(user: any) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    private setToken(token: string) {
        localStorage.setItem(this.tokenKey, token);
    }

    isLoggedIn() {
        return !!this.getUser();
    }
}

import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private tokenKey = 'nalamdesk_token';
    private userKey = 'nalamdesk_user';

    constructor() { }

    async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
        // Check if in Electron (Local)
        if (window.electron) {
            // Local Login: Traditionally just password, but we are moving to Username/Pass.
            // IPC needs an update to accept username?
            // Actually, for Master, we auto-login or use simple auth.
            // BUT if we want unified RBAC, even Master should use the same auth flow?
            // Let's assume Master uses the same flow: `ipcRenderer.invoke('auth:login', {username, password})`
            // Wait, current IPC `auth:login` takes just password. I need to update IPC handler too!
            // Or, for Master, we keep it simple (Password only -> Admin).
            // Let's check main.ts IPC again. It takes password and uses it to key DB.

            // CRITICAL DEVIATION: The existing system uses the password to DERIVE the DB KEY.
            // If we change this, we break DB encryption/unlocking.
            // So for MASTER (Electron), the "Login" is actually "Unlock DB".
            // The Admin User is implicitly logged in when DB is unlocked.

            // So:
            // If Electron: Call existing `login(password)`. If success, set user as Admin.
            try {
                // Pass full object
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
            // Remote Login (Browser)
            // Hit API
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

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        // If Electron, maybe close DB? existing app doesn't seem to have explicit logout that closes DB.
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
        return !!this.getUser(); // Simple check
    }
}

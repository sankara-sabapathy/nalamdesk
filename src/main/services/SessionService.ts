import * as crypto from 'crypto';

export interface UserSession {
    id: number;
    username: string;
    role: string;
    name: string;
    specialty?: string;
    license_number?: string;
    sessionId?: string;
}

export class SessionService {
    private currentUser: UserSession | null = null;

    setUser(user: UserSession) {
        if (user == null || user.id == null || typeof user.id !== 'number' || !user.username || !user.role || !user.name) {
            throw new Error('Invalid user session data');
        }
        this.currentUser = {
            ...user,
            sessionId: crypto.randomUUID()
        };
    }

    getUser(): UserSession | null {
        return this.currentUser;
    }

    clearSession() {
        this.currentUser = null;
    }

    isAuthenticated(): boolean {
        return !!this.currentUser;
    }
}

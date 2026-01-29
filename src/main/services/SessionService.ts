export interface UserSession {
    id: number;
    username: string;
    role: string;
    name: string;
    specialty?: string;
    license_number?: string;
}

export class SessionService {
    private currentUser: UserSession | null = null;

    setUser(user: UserSession) {
        this.currentUser = user;
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

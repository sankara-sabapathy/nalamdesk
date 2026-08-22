import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from './SessionService';

describe('SessionService', () => {
    let service: SessionService;

    beforeEach(() => {
        service = new SessionService();
    });

    it('should start with no user', () => {
        expect(service.getUser()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
    });

    it('should set and get user', () => {
        const user = {
            id: 1,
            username: 'test',
            role: 'doctor',
            name: 'Test Doc'
        };
        service.setUser(user);
        const retrieved = service.getUser();
        expect(retrieved).toEqual(expect.objectContaining(user));
        expect(retrieved?.sessionId).toBeDefined();
        expect(service.isAuthenticated()).toBe(true);
    });

    it('should clear session', () => {
        const user = {
            id: 1,
            username: 'test',
            role: 'doctor',
            name: 'Test Doc'
        };
        service.setUser(user);
        service.clearSession();
        expect(service.getUser()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
    });

    it('allowlists session fields and never retains a password hash', () => {
        service.setUser({
            id: 1,
            username: 'admin',
            role: 'admin',
            name: 'Administrator',
            password_reset_required: 0,
            password: '$argon2id$secret-hash'
        } as any);
        const session = service.getUser() as any;
        expect(session.password).toBeUndefined();
        expect(session.password_reset_required).toBe(0);
        expect(Object.keys(session).sort()).toEqual([
            'id', 'name', 'password_reset_required', 'role', 'sessionId', 'username'
        ]);
    });
});

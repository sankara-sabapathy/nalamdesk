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
});

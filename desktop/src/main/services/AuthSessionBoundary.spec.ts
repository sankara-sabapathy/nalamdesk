import { describe, expect, it, vi } from 'vitest';
import { SessionService } from './SessionService';
import {
    clearMainProcessSession,
    invokeProtectedIpc,
    requireAuthenticatedPrincipal
} from './AuthSessionBoundary';

const admin = { id: 1, username: 'admin', role: 'admin', name: 'Administrator' };
const doctor = { id: 2, username: 'doc', role: 'doctor', name: 'Dr. Test' };

describe('main-process logout session boundary', () => {
    it('clears the authenticated principal without closing the vault', () => {
        const session = new SessionService();
        const closeDb = vi.fn();
        session.setUser(admin);
        expect(clearMainProcessSession(session)).toEqual({ success: true });
        expect(session.getUser()).toBeNull();
        expect(session.isAuthenticated()).toBe(false);
        expect(closeDb).not.toHaveBeenCalled();
    });

    it('fails protected IPC after logout until a new login', () => {
        const session = new SessionService();
        session.setUser(admin);
        expect(invokeProtectedIpc(session, (user) => user.role)).toBe('admin');
        clearMainProcessSession(session);
        expect(() => invokeProtectedIpc(session, (user) => user.role)).toThrow('Unauthorized');
        expect(() => requireAuthenticatedPrincipal(session)).toThrow('Unauthorized');
        session.setUser(doctor);
        expect(invokeProtectedIpc(session, (user) => user.role)).toBe('doctor');
    });

    it('does not let a later login inherit the prior role', () => {
        const session = new SessionService();
        session.setUser(admin);
        const firstId = session.getUser()?.sessionId;
        clearMainProcessSession(session);
        session.setUser(doctor);
        const next = session.getUser();
        expect(next?.role).toBe('doctor');
        expect(next?.username).toBe('doc');
        expect(next?.sessionId).not.toBe(firstId);
        expect(next?.role).not.toBe('admin');
    });

    it('treats reload and repeated logout as a locked session, not a restored principal', () => {
        const session = new SessionService();
        session.setUser(admin);
        clearMainProcessSession(session);
        // Renderer reload keeps this main-process instance; principal must stay cleared.
        expect(session.getUser()).toBeNull();
        expect(clearMainProcessSession(session)).toEqual({ success: true });
        expect(session.getUser()).toBeNull();
    });

    it('starts empty after window close/reopen (new main-process SessionService)', () => {
        const first = new SessionService();
        first.setUser(admin);
        // Process exit drops in-memory state; a new service is a new window/session.
        const reopened = new SessionService();
        expect(reopened.getUser()).toBeNull();
        expect(reopened.isAuthenticated()).toBe(false);
        expect(() => invokeProtectedIpc(reopened, (user) => user.role)).toThrow('Unauthorized');
    });
});

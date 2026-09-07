import type { SessionService, UserSession } from './SessionService';

/**
 * Logout session boundary: clear the authenticated principal.
 * Device vault / SQLCipher stays on the existing unlock path — do not closeDb here.
 */
export function clearMainProcessSession(sessionService: SessionService): { success: true } {
    sessionService.clearSession();
    return { success: true };
}

export function requireAuthenticatedPrincipal(sessionService: SessionService): UserSession {
    const user = sessionService.getUser();
    if (!user) {
        throw new Error('Unauthorized');
    }
    return user;
}

/** Model of a protected IPC operation gated on the main-process principal. */
export function invokeProtectedIpc<T>(
    sessionService: SessionService,
    operation: (user: UserSession) => T
): T {
    return operation(requireAuthenticatedPrincipal(sessionService));
}

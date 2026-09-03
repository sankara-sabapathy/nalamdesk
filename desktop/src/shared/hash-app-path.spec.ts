import { describe, expect, it, vi } from 'vitest';
import { hashUrlForPathname, isHashSpaAppPath, rewriteNonHashAppPath } from './hash-app-path';

describe('hash SPA path rewrite', () => {
    it('rewrites /settings to /#/settings', () => {
        expect(hashUrlForPathname('/settings')).toBe('/#/settings');
    });

    it('rewrites nested app paths and preserves the query string', () => {
        expect(hashUrlForPathname('/patients/12', '?q=1')).toBe('/#/patients/12?q=1');
        expect(hashUrlForPathname('/visit/3')).toBe('/#/visit/3');
        expect(hashUrlForPathname('/online-booking')).toBe('/#/online-booking');
        expect(hashUrlForPathname('/queue')).toBe('/#/queue');
        expect(hashUrlForPathname('/dashboard')).toBe('/#/dashboard');
    });

    it('does not rewrite empty, hashed, asset, or API paths', () => {
        expect(hashUrlForPathname('/')).toBeNull();
        expect(hashUrlForPathname('/index.html')).toBeNull();
        expect(hashUrlForPathname('/assets/logo.png')).toBeNull();
        expect(hashUrlForPathname('/api/auth/login')).toBeNull();
        expect(isHashSpaAppPath('/settings')).toBe(true);
        expect(isHashSpaAppPath('/oauth2callback')).toBe(false);
    });

    it('rewrites a location before Angular maps an empty hash to login', () => {
        const replace = vi.fn();
        expect(rewriteNonHashAppPath({
            pathname: '/settings', hash: '', search: '', replace
        })).toBe(true);
        expect(replace).toHaveBeenCalledWith('/#/settings');
    });

    it('leaves an existing hash session untouched', () => {
        const replace = vi.fn();
        expect(rewriteNonHashAppPath({
            pathname: '/', hash: '#/settings', search: '', replace
        })).toBe(false);
        expect(replace).not.toHaveBeenCalled();
    });
});

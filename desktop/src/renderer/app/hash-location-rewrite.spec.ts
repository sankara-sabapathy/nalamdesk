/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { rewriteNonHashAppPath } from './hash-location-rewrite';

describe('renderer hash rewrite', () => {
    beforeEach(() => {
        localStorage.setItem('nalamdesk_user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
    });

    it('rewrites /settings without dropping nalamdesk_user', () => {
        const replace = vi.fn();
        expect(rewriteNonHashAppPath({
            pathname: '/settings', hash: '', search: '', replace
        })).toBe(true);
        expect(replace).toHaveBeenCalledWith('/#/settings');
        expect(localStorage.getItem('nalamdesk_user')).toContain('admin');
    });

    it('preserves search on rewrite', () => {
        const replace = vi.fn();
        expect(rewriteNonHashAppPath({
            pathname: '/settings', hash: '', search: '?tab=active', replace
        })).toBe(true);
        expect(replace).toHaveBeenCalledWith('/#/settings?tab=active');
    });
});

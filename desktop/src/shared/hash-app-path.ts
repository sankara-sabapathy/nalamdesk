/** Hash-SPA paths that must rewrite before Angular maps an empty hash to login. */
const APP_PATH = /^\/(login|setup|recover|change-password|dashboard|patients|visits|visit|online-booking|settings|queue)(\/[^/]+)*$/;

export function normalizeAppPathname(pathname: string): string {
    if (!pathname) return '/';
    const decoded = pathname.split('?')[0] || '/';
    if (decoded.length > 1 && decoded.endsWith('/')) return decoded.slice(0, -1);
    return decoded;
}

export function isHashSpaAppPath(pathname: string): boolean {
    return APP_PATH.test(normalizeAppPathname(pathname));
}

/** `/settings` → `/#/settings`. Leaves hashed URLs, `/`, assets, and APIs alone. */
export function hashUrlForPathname(pathname: string, search = ''): string | null {
    const path = normalizeAppPathname(pathname);
    if (!isHashSpaAppPath(path)) return null;
    return `/#${path}${search || ''}`;
}

export function rewriteNonHashAppPath(loc: {
    pathname: string;
    hash: string;
    search: string;
    replace: (url: string) => void;
}): boolean {
    if (loc.hash && loc.hash.length > 1) return false;
    const target = hashUrlForPathname(loc.pathname, loc.search);
    if (!target) return false;
    loc.replace(target);
    return true;
}

/** Hash-SPA roots that must rewrite before Angular maps an empty hash to login. */
const APP_ROOTS = new Set([
    'login', 'setup', 'recover', 'change-password', 'dashboard',
    'patients', 'visits', 'visit', 'online-booking', 'settings', 'queue'
]);

/** Clinic app paths are short (`/patients/:id`). Reject pathological GETs linearly. */
const MAX_APP_PATH_LENGTH = 256;

export function normalizeAppPathname(pathname: string): string {
    if (!pathname) return '/';
    const decoded = pathname.split('?')[0] || '/';
    if (decoded.length > 1 && decoded.endsWith('/')) return decoded.slice(0, -1);
    return decoded;
}

/** Linear scan: `/settings`, `/patients/12`, `/visit/3`. No nested regex quantifiers. */
export function isHashSpaAppPath(pathname: string): boolean {
    const path = normalizeAppPathname(pathname);
    if (path.length < 2 || path.length > MAX_APP_PATH_LENGTH || path.charCodeAt(0) !== 47) return false;
    const rest = path.slice(1);
    const slash = rest.indexOf('/');
    const root = slash === -1 ? rest : rest.slice(0, slash);
    if (!APP_ROOTS.has(root)) return false;
    if (slash === -1) return true;
    for (let i = slash; i < rest.length; ) {
        if (rest.charCodeAt(i) !== 47) return false;
        i += 1;
        const start = i;
        while (i < rest.length && rest.charCodeAt(i) !== 47) i += 1;
        if (i === start) return false;
    }
    return true;
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

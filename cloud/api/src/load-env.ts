import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

let loaded = false;

/** Load repo-root `.env.development` then optional `.env.local` overrides. Idempotent. */
export function loadDevelopmentEnv(): void {
    if (loaded) {
        return;
    }
    loaded = true;

    for (const root of collectSearchRoots()) {
        const devEnv = path.join(root, '.env.development');
        if (!fs.existsSync(devEnv)) {
            continue;
        }
        dotenv.config({ path: devEnv });
        const localEnv = path.join(root, '.env.local');
        if (fs.existsSync(localEnv)) {
            dotenv.config({ path: localEnv });
        }
        return;
    }
}

function collectSearchRoots(): string[] {
    const roots: string[] = [];
    const seen = new Set<string>();

    const addRoot = (candidate: string) => {
        const resolved = path.resolve(candidate);
        if (seen.has(resolved)) {
            return;
        }
        seen.add(resolved);
        roots.push(resolved);
    };

    addRoot(process.cwd());
    addRoot(path.join(process.cwd(), '..'));
    addRoot(path.join(process.cwd(), '../..'));
    addRoot(path.join(__dirname, '../../..'));

    return roots;
}

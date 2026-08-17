import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

let loaded = false;

/** Load repo-root `.env.development` then optional `.env.local` overrides. Idempotent. */
export function loadDevelopmentEnv(): void {
    if (loaded) {
        return;
    }
    loaded = true;

    const envPaths = resolveEnvFilePaths();
    for (const envPath of envPaths) {
        dotenv.config({ path: envPath });
    }
}

function resolveEnvFilePaths(): string[] {
    const found: string[] = [];
    const roots = collectSearchRoots();

    for (const root of roots) {
        const devEnv = path.join(root, '.env.development');
        if (fs.existsSync(devEnv)) {
            found.push(devEnv);
            const localEnv = path.join(root, '.env.local');
            if (fs.existsSync(localEnv)) {
                found.push(localEnv);
            }
            return found;
        }
    }

    return found;
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

    // Compiled: desktop/dist/shared → repo root is ../../..
    addRoot(path.join(__dirname, '../../..'));

    return roots;
}

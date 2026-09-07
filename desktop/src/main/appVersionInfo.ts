import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BuildIdentity {
    version?: string;
    commit?: string | null;
    buildId?: string | null;
}

export interface AppVersionInfo {
    version: string;
    commit: string | null;
    buildId: string | null;
    isDev: boolean;
    packaged: boolean;
    display: string;
}

export function buildIdentityPath(appPath: string): string {
    return path.join(appPath, 'build-identity.json');
}

export function readBuildIdentityFile(identityPath: string, readFile = (file: string) => fs.readFileSync(file, 'utf8')): BuildIdentity | null {
    try {
        const parsed = JSON.parse(readFile(identityPath)) as BuildIdentity;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

export function shortCommit(commit: string | null | undefined): string | null {
    if (!commit || typeof commit !== 'string') return null;
    const trimmed = commit.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 7);
}

export function formatAppVersionDisplay(input: {
    version: string;
    isDev: boolean;
    commit?: string | null;
}): string {
    const sha = shortCommit(input.commit);
    if (input.isDev) {
        return sha ? `${input.version} (development, ${sha})` : `${input.version} (development)`;
    }
    return sha ? `${input.version} (${sha})` : input.version;
}

export function resolveAppVersionInfo(input: {
    version: string;
    isPackaged: boolean;
    isDev: boolean;
    identity?: BuildIdentity | null;
}): AppVersionInfo {
    const commit = input.identity?.commit || null;
    const buildId = input.identity?.buildId || null;
    return {
        version: input.version,
        commit,
        buildId,
        isDev: input.isDev,
        packaged: input.isPackaged,
        display: formatAppVersionDisplay({
            version: input.version,
            isDev: input.isDev,
            commit
        })
    };
}

export function loadAppVersionInfo(app: {
    getVersion(): string;
    isPackaged: boolean;
    getAppPath(): string;
}, isDev: boolean): AppVersionInfo {
    const identity = readBuildIdentityFile(buildIdentityPath(app.getAppPath()));
    return resolveAppVersionInfo({
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        isDev,
        identity
    });
}

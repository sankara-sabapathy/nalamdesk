/**
 * In-app update feed configuration.
 *
 * Interim channel (this PR): generic provider. Ops hosts approved
 * `latest*.yml` plus OS packages at `NALAMDESK_UPDATE_FEED_URL`.
 * Feature CI PR zips / Actions artifacts are not an update channel.
 *
 * Later PR seam: set `NALAMDESK_UPDATE_PROVIDER=github` (and optional
 * owner/repo). IPC and renderer UX stay the same — only this resolver
 * and `toElectronUpdaterOptions()` change.
 */

export type UpdateProviderKind = 'generic' | 'github';
export type SignatureMode = 'feed-checksum' | 'release-signed';
export type OsApplyMode = 'nsis' | 'dmg' | 'appimage-updater' | 'open-download-page';

export interface GenericUpdateFeed {
    provider: 'generic';
    url: string;
    signatureMode: 'feed-checksum';
    downloadPageUrl: string;
}

export interface GithubUpdateFeed {
    provider: 'github';
    owner: string;
    repo: string;
    signatureMode: SignatureMode;
    downloadPageUrl: string;
}

export type UpdateFeedConfig = GenericUpdateFeed | GithubUpdateFeed;

export const DEFAULT_UPDATE_DOWNLOAD_PAGE = 'https://github.com/sankara-sabapathy/nalamdesk';

export function resolveUpdateFeedConfig(env: NodeJS.Dict<string> = process.env): UpdateFeedConfig | null {
    const downloadPageUrl = trimSlash(env['NALAMDESK_UPDATE_DOWNLOAD_PAGE'] || DEFAULT_UPDATE_DOWNLOAD_PAGE);
    const provider = (env['NALAMDESK_UPDATE_PROVIDER'] || 'generic').trim().toLowerCase();

    if (provider === 'github') {
        return {
            provider: 'github',
            owner: (env['NALAMDESK_UPDATE_GITHUB_OWNER'] || 'sankara-sabapathy').trim(),
            repo: (env['NALAMDESK_UPDATE_GITHUB_REPO'] || 'nalamdesk').trim(),
            signatureMode: env['NALAMDESK_UPDATE_RELEASE_SIGNED'] === '1' ? 'release-signed' : 'feed-checksum',
            downloadPageUrl
        };
    }

    const url = (env['NALAMDESK_UPDATE_FEED_URL'] || '').trim();
    if (!url) return null;
    return {
        provider: 'generic',
        url: trimSlash(url),
        signatureMode: 'feed-checksum',
        downloadPageUrl
    };
}

export function toElectronUpdaterOptions(config: UpdateFeedConfig): Record<string, string> {
    if (config.provider === 'github') {
        return { provider: 'github', owner: config.owner, repo: config.repo };
    }
    return { provider: 'generic', url: config.url };
}

export function isNewerVersion(latest: string, current: string): boolean {
    const next = parseVersion(latest);
    const running = parseVersion(current);
    for (let i = 0; i < 3; i++) {
        if (next[i] > running[i]) return true;
        if (next[i] < running[i]) return false;
    }
    return false;
}

export function feedHasAppImage(updateInfo: { files?: Array<{ url?: string }>; path?: string } | null | undefined): boolean {
    const names = [updateInfo?.path || '', ...(updateInfo?.files || []).map((file) => file.url || '')];
    return names.some((name) => /\.AppImage(\?|$)/i.test(name));
}

export function resolveOsApplyPath(input: {
    platform: NodeJS.Platform | string;
    isAppImage: boolean;
    feedHasAppImage: boolean;
}): { mode: OsApplyMode; canQuitAndInstall: boolean } {
    if (input.platform === 'win32') return { mode: 'nsis', canQuitAndInstall: true };
    if (input.platform === 'darwin') return { mode: 'dmg', canQuitAndInstall: true };
    if (input.platform === 'linux' && input.isAppImage && input.feedHasAppImage) {
        return { mode: 'appimage-updater', canQuitAndInstall: true };
    }
    return { mode: 'open-download-page', canQuitAndInstall: false };
}

export function signatureClaim(mode: SignatureMode): { verifiedSignature: boolean; integrityNote: string } {
    if (mode === 'release-signed') {
        return {
            verifiedSignature: true,
            integrityNote: 'This update is release-signed.'
        };
    }
    return {
        verifiedSignature: false,
        integrityNote: 'This feed lists package checksums. NalamDesk does not claim full code-signature verification.'
    };
}

export function plainUpdateError(error: unknown): string {
    const message = String((error as Error)?.message || error || '');
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|net::ERR|offline|getaddrinfo/i.test(message)) {
        return 'Could not reach the update feed. Check the network and try again.';
    }
    if (/YAMLException|Cannot find channel|latest.*\.yml|status code 404|404 Not Found/i.test(message)) {
        return 'The update feed is missing or invalid.';
    }
    if (/SHA512|checksum|code signature|not signed/i.test(message)) {
        return 'The downloaded update did not match the feed checksum.';
    }
    if (/cancel/i.test(message)) {
        return 'Update download cancelled.';
    }
    const trimmed = message.trim();
    return trimmed || 'Update failed.';
}

export function formatReleaseNotes(notes: string | Array<{ note?: string }> | undefined): string {
    if (!notes) return '';
    if (typeof notes === 'string') return notes.trim();
    return notes.map((item) => String(item?.note || '').trim()).filter(Boolean).join('\n');
}

function parseVersion(value: string): [number, number, number] {
    const parts = String(value || '').replace(/^v/i, '').split(/[.-]/);
    return [toInt(parts[0]), toInt(parts[1]), toInt(parts[2])];
}

function toInt(part: string | undefined): number {
    const parsed = parseInt(part || '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function trimSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

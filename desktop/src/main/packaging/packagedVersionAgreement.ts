import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatAppVersionDisplay, type BuildIdentity } from '../appVersionInfo';
import { linuxDebFileName } from '../linuxFuseGuard';

export interface PackagedVersionAgreementInput {
    version: string;
    identity?: BuildIdentity | null;
    artifactNames: string[];
    latestYmlContents?: Record<string, string>;
    platform: NodeJS.Platform | string;
    displayedVersion?: string;
}

export function parseLatestYmlVersion(text: string): string | null {
    const match = /^version:\s*['"]?([^\s'"]+)['"]?\s*$/m.exec(text);
    return match?.[1] || null;
}

export function displayedVersionFromManifest(version: string, identity: BuildIdentity | null | undefined, isDev: boolean): string {
    return formatAppVersionDisplay({ version, isDev, commit: identity?.commit });
}

export function assertPackagedVersionAgreement(input: PackagedVersionAgreementInput): void {
    const { version, identity, artifactNames, platform } = input;
    if (!version || version === '0.0.0') {
        throw new Error(`Refusing to package hard-coded version ${JSON.stringify(version)}`);
    }
    if (identity?.version && identity.version !== version) {
        throw new Error(`build-identity.json version ${identity.version} does not match package.json ${version}`);
    }

    const displayed = input.displayedVersion
        || displayedVersionFromManifest(version, identity, false);
    if (!displayed.startsWith(version)) {
        throw new Error(`Displayed version ${JSON.stringify(displayed)} does not start with manifest ${version}`);
    }

    if (platform === 'linux') {
        const deb = artifactNames.filter((name) => name.endsWith('.deb'));
        if (deb.length === 0) {
            throw new Error('Linux clinic artifact (.deb) is missing from the release directory');
        }
        if (!deb.some((name) => name.includes(version))) {
            throw new Error(`Linux .deb names do not include version ${version}: ${deb.join(', ')}`);
        }
        const expectedDeb = linuxDebFileName(version);
        if (!deb.some((name) => name === expectedDeb || name.endsWith(expectedDeb))) {
            throw new Error(`Expected clinic .deb named ${expectedDeb}, found ${deb.join(', ')}`);
        }
        for (const name of artifactNames.filter((file) => file.endsWith('.AppImage'))) {
            if (!name.includes(version)) {
                throw new Error(`AppImage name ${name} does not include version ${version}`);
            }
        }
    }

    const matching = artifactNames.filter((name) => name.includes(version));
    if (matching.length === 0) {
        throw new Error(`No release artifact name contains version ${version}: ${artifactNames.join(', ') || '(none)'}`);
    }

    for (const [fileName, contents] of Object.entries(input.latestYmlContents || {})) {
        const ymlVersion = parseLatestYmlVersion(contents);
        if (ymlVersion && ymlVersion !== version) {
            throw new Error(`${fileName} version ${ymlVersion} does not match package.json ${version}`);
        }
    }
}

export function readReleaseAgreement(releaseDir: string, version: string, identity: BuildIdentity | null, platform: NodeJS.Platform | string): PackagedVersionAgreementInput {
    const entries = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir) : [];
    const latestYmlContents: Record<string, string> = {};
    for (const name of entries) {
        if (!/^latest.*\.yml$/i.test(name)) continue;
        latestYmlContents[name] = fs.readFileSync(path.join(releaseDir, name), 'utf8');
    }
    return {
        version,
        identity,
        artifactNames: entries,
        latestYmlContents,
        platform,
        displayedVersion: displayedVersionFromManifest(version, identity, false)
    };
}

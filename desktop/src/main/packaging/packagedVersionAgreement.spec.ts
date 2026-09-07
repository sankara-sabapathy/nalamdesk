import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    assertPackagedVersionAgreement,
    parseLatestYmlVersion,
    readReleaseAgreement
} from './packagedVersionAgreement';

describe('packaged version agreement', () => {
    it('accepts matching manifest, .deb, AppImage, yml, and displayed version', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            identity: { version: '0.0.8', commit: 'abc1234def' },
            artifactNames: [
                'nalamdesk-desktop_0.0.8_amd64.deb',
                'NalamDesk-0.0.8.AppImage',
                'latest-linux.yml'
            ],
            latestYmlContents: {
                'latest-linux.yml': 'version: 0.0.8\npath: NalamDesk-0.0.8.AppImage\n'
            },
            platform: 'linux',
            displayedVersion: '0.0.8 (abc1234)'
        })).not.toThrow();
        expect(parseLatestYmlVersion('version: 0.0.8\n')).toBe('0.0.8');
    });

    it('fails when the Linux .deb is missing or names diverge', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['NalamDesk-0.0.8.AppImage'],
            platform: 'linux'
        })).toThrow(/clinic artifact \(\.deb\) is missing/i);

        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['nalamdesk-desktop_0.0.7_amd64.deb'],
            platform: 'linux'
        })).toThrow(/do not include version 0\.0\.8/);

        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            identity: { version: '0.0.7' },
            artifactNames: ['nalamdesk-desktop_0.0.8_amd64.deb'],
            platform: 'linux'
        })).toThrow(/does not match package.json/);

        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['nalamdesk-desktop_0.0.8_amd64.deb'],
            platform: 'linux',
            displayedVersion: '0.0.0'
        })).toThrow(/Displayed version/);
    });

    it('rejects a displayed version with a mismatched commit suffix', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            identity: { version: '0.0.8', commit: 'abc1234def' },
            artifactNames: ['nalamdesk-desktop_0.0.8_amd64.deb'],
            platform: 'linux',
            displayedVersion: '0.0.8 (development, deadbeef)'
        })).toThrow(/does not match expected 0\.0\.8 \(abc1234\)/);
    });

    it('requires a versioned artifact on macOS/Windows without redesigning those targets', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['NalamDesk-0.0.8.dmg'],
            platform: 'darwin'
        })).not.toThrow();
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['NalamDesk Setup 0.0.8.exe'],
            platform: 'win32'
        })).not.toThrow();
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['NalamDesk Setup.exe'],
            platform: 'win32'
        })).toThrow(/No release artifact name contains version/);
    });

    it('refuses a hard-coded 0.0.0 package version', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.0',
            artifactNames: ['nalamdesk-desktop_0.0.0_amd64.deb'],
            platform: 'linux'
        })).toThrow(/hard-coded version/);
    });

    it('requires the clinic .deb filename, a versioned AppImage, and matching latest.yml', () => {
        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['nalamdesk-desktop_0.0.8.deb'],
            platform: 'linux'
        })).toThrow(/Expected clinic \.deb named nalamdesk-desktop_0\.0\.8_amd64\.deb/);

        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['nalamdesk-desktop_0.0.8_amd64.deb', 'NalamDesk.AppImage'],
            platform: 'linux'
        })).toThrow(/AppImage name NalamDesk\.AppImage does not include version/);

        expect(() => assertPackagedVersionAgreement({
            version: '0.0.8',
            artifactNames: ['nalamdesk-desktop_0.0.8_amd64.deb'],
            latestYmlContents: { 'latest-linux.yml': 'version: 0.0.7\n' },
            platform: 'linux'
        })).toThrow(/latest-linux\.yml version 0\.0\.7 does not match package.json 0\.0\.8/);
    });

    it('reads latest.yml from a release directory and skips non-yml files', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nalamdesk-release-'));
        try {
            fs.writeFileSync(path.join(dir, 'nalamdesk-desktop_0.0.8_amd64.deb'), '');
            fs.writeFileSync(path.join(dir, 'latest-linux.yml'), 'version: 0.0.8\n');
            fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore');
            const input = readReleaseAgreement(dir, '0.0.8', { version: '0.0.8', commit: 'abc1234def' }, 'linux');
            expect(input.artifactNames).toEqual(expect.arrayContaining([
                'nalamdesk-desktop_0.0.8_amd64.deb',
                'latest-linux.yml'
            ]));
            expect(input.latestYmlContents['latest-linux.yml']).toContain('version: 0.0.8');
            expect(input.displayedVersion).toBe('0.0.8 (abc1234)');
            expect(() => assertPackagedVersionAgreement(input)).not.toThrow();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('treats a missing release directory as empty artifacts', () => {
        const missing = path.join(os.tmpdir(), `nalamdesk-missing-release-${Date.now()}`);
        const input = readReleaseAgreement(missing, '0.0.8', null, 'linux');
        expect(input.artifactNames).toEqual([]);
        expect(input.latestYmlContents).toEqual({});
        expect(() => assertPackagedVersionAgreement(input)).toThrow(/clinic artifact \(\.deb\) is missing/i);
    });
});

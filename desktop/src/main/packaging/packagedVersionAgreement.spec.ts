import { describe, expect, it } from 'vitest';
import {
    assertPackagedVersionAgreement,
    parseLatestYmlVersion
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
});

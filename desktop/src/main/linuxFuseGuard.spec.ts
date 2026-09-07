import { describe, expect, it } from 'vitest';
import {
    appImageFuseGuardScript,
    formatMissingFuseMessage,
    fuseLibraryPresent,
    linuxClinicInstallInstructions,
    linuxDebFileName
} from './linuxFuseGuard';

describe('Linux FUSE / .deb clinic path', () => {
    it('names the .deb as the install path and refuses squashfs extract', () => {
        const message = formatMissingFuseMessage({ version: '0.0.8' });
        expect(message).toContain('libfuse.so.2');
        expect(message).toContain('sudo apt install ./nalamdesk-desktop_0.0.8_amd64.deb');
        expect(message).toMatch(/Do not extract the AppImage squashfs/i);
        expect(linuxClinicInstallInstructions('0.0.8')).toContain('Primary package: nalamdesk-desktop_0.0.8_amd64.deb');
        expect(linuxClinicInstallInstructions('0.0.8')).not.toMatch(/unsquashfs|--appimage-extract-and-run/i);
    });

    it('detects libfuse.so.2 from common loader paths', () => {
        expect(fuseLibraryPresent(() => false)).toBe(false);
        expect(fuseLibraryPresent((file) => file.endsWith('libfuse.so.2') && file.includes('x86_64'))).toBe(true);
        expect(linuxDebFileName('1.2.3', 'arm64')).toBe('nalamdesk-desktop_1.2.3_arm64.deb');
    });

    it('emits an AppImage guard that fails closed without FUSE', () => {
        const script = appImageFuseGuardScript({
            version: '0.0.8',
            appImageFileName: 'NalamDesk-0.0.8.AppImage'
        });
        expect(script.startsWith('#!/bin/sh')).toBe(true);
        expect(script).toContain('NalamDesk-0.0.8.AppImage');
        expect(script).toContain('libfuse.so.2');
        expect(script).toContain('nalamdesk-desktop_0.0.8_amd64.deb');
        expect(script).toContain('exit 1');
    });
});

import * as fs from 'node:fs';

export const LINUX_PACKAGE_NAME = 'nalamdesk-desktop';

const FUSE2_CANDIDATES = [
    '/lib/x86_64-linux-gnu/libfuse.so.2',
    '/usr/lib/x86_64-linux-gnu/libfuse.so.2',
    '/lib/libfuse.so.2',
    '/usr/lib/libfuse.so.2',
    '/lib64/libfuse.so.2',
    '/usr/lib64/libfuse.so.2'
];

export function linuxDebFileName(version: string, arch = 'amd64'): string {
    return `${LINUX_PACKAGE_NAME}_${version}_${arch}.deb`;
}

export function fuseLibraryPresent(existsSync: (file: string) => boolean = (file) => fs.existsSync(file)): boolean {
    return FUSE2_CANDIDATES.some((candidate) => existsSync(candidate));
}

/** Actionable failure when FUSE 2 is missing. Clinic path is the .deb, not squashfs extract. */
export function formatMissingFuseMessage(input: { version: string; debFileName?: string }): string {
    const deb = input.debFileName || linuxDebFileName(input.version);
    return [
        'NalamDesk AppImage requires FUSE 2 (libfuse.so.2) and cannot start without it.',
        `Install the clinic .deb package instead:`,
        `  sudo apt install ./${deb}`,
        'If apt is unavailable: sudo dpkg -i ' + deb,
        'Do not extract the AppImage squashfs or use --appimage-extract as an install path.'
    ].join('\n');
}

export function linuxClinicInstallInstructions(version: string): string {
    const deb = linuxDebFileName(version);
    return [
        'NalamDesk Linux clinic install',
        '================================',
        '',
        `Primary package: ${deb}`,
        '',
        `  sudo apt install ./${deb}`,
        '',
        'If apt is unavailable:',
        '',
        `  sudo dpkg -i ${deb}`,
        '  sudo apt-get install -f',
        '',
        'Launch NalamDesk from the applications menu.',
        '',
        'The AppImage is a secondary artifact and requires FUSE 2 (libfuse.so.2).',
        'If the AppImage does not start, install the .deb — do not extract the squashfs.',
        ''
    ].join('\n');
}

export function appImageFuseGuardScript(input: { version: string; appImageFileName: string }): string {
    const message = formatMissingFuseMessage({ version: input.version });
    const quotedMessage = JSON.stringify(message);
    return `#!/bin/sh
set -eu
# Secondary AppImage launcher. Clinic installs should use the .deb.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APPIMAGE="$DIR/${input.appImageFileName}"
if [ -e /lib/x86_64-linux-gnu/libfuse.so.2 ] || [ -e /usr/lib/x86_64-linux-gnu/libfuse.so.2 ] || [ -e /lib/libfuse.so.2 ] || [ -e /usr/lib/libfuse.so.2 ] || [ -e /lib64/libfuse.so.2 ] || [ -e /usr/lib64/libfuse.so.2 ]; then
  exec "$APPIMAGE" "$@"
fi
printf '%s\\n' ${quotedMessage} >&2
exit 1
`;
}

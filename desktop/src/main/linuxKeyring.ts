/** Chromium password-store switch. Must be applied before `app` is ready. */
export const LINUX_PASSWORD_STORE_SWITCH = 'password-store';

/** Electron/Chromium name for libsecret. Distinct from `getSelectedStorageBackend()` (`gnome_libsecret`). */
export const LINUX_PREFERRED_KEYRING = 'gnome-libsecret';

export interface CommandLineSwitches {
    appendSwitch(name: string, value?: string): void;
}

/**
 * Prefer gnome-libsecret on Linux at process start so OSCrypt does not fall
 * back to `basic_text` on non-GNOME sessions. Not a user-facing CLI flag.
 */
export function preferLinuxGnomeLibsecret(
    commandLine: CommandLineSwitches,
    platform: NodeJS.Platform = process.platform
): boolean {
    if (platform !== 'linux') {
        return false;
    }
    commandLine.appendSwitch(LINUX_PASSWORD_STORE_SWITCH, LINUX_PREFERRED_KEYRING);
    return true;
}

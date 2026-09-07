import { describe, expect, it, vi } from 'vitest';
import {
    LINUX_PASSWORD_STORE_SWITCH,
    LINUX_PREFERRED_KEYRING,
    preferLinuxGnomeLibsecret
} from './linuxKeyring';

describe('preferLinuxGnomeLibsecret', () => {
    it('appends gnome-libsecret at process start on Linux', () => {
        const appendSwitch = vi.fn();
        expect(preferLinuxGnomeLibsecret({ appendSwitch }, 'linux')).toBe(true);
        expect(appendSwitch).toHaveBeenCalledOnce();
        expect(appendSwitch).toHaveBeenCalledWith(LINUX_PASSWORD_STORE_SWITCH, LINUX_PREFERRED_KEYRING);
        expect(LINUX_PREFERRED_KEYRING).toBe('gnome-libsecret');
        expect(LINUX_PREFERRED_KEYRING).not.toBe('basic');
    });

    it('does not touch the password store on macOS or Windows', () => {
        const appendSwitch = vi.fn();
        expect(preferLinuxGnomeLibsecret({ appendSwitch }, 'darwin')).toBe(false);
        expect(preferLinuxGnomeLibsecret({ appendSwitch }, 'win32')).toBe(false);
        expect(appendSwitch).not.toHaveBeenCalled();
    });
});

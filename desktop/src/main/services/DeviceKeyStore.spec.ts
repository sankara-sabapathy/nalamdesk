import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeStorage = {
    isEncryptionAvailable: vi.fn(),
    getSelectedStorageBackend: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn()
};

vi.mock('electron', () => ({ safeStorage }));

describe('ElectronSafeStorageDeviceKeyStore', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        safeStorage.isEncryptionAvailable.mockReturnValue(true);
        safeStorage.getSelectedStorageBackend.mockReturnValue('keychain');
    });

    it('round-trips a 32-byte key without exposing plaintext to the config', async () => {
        const key = Buffer.alloc(32, 7);
        safeStorage.encryptString.mockReturnValue(Buffer.from('ciphertext'));
        safeStorage.decryptString.mockReturnValue(key.toString('base64'));
        const { ElectronSafeStorageDeviceKeyStore } = await import('./DeviceKeyStore');
        const store = new ElectronSafeStorageDeviceKeyStore();
        expect(store.protect(key)).toEqual(Buffer.from('ciphertext'));
        expect(safeStorage.encryptString).toHaveBeenCalledWith(key.toString('base64'));
        expect(store.unprotect(Buffer.from('ciphertext'))).toEqual(key);
    });

    it('fails when Electron reports encryption unavailable', async () => {
        safeStorage.isEncryptionAvailable.mockReturnValue(false);
        const { ElectronSafeStorageDeviceKeyStore } = await import('./DeviceKeyStore');
        const store = new ElectronSafeStorageDeviceKeyStore();
        expect(store.status()).toMatchObject({ available: false, reason: 'ENCRYPTION_UNAVAILABLE' });
        expect(() => store.protect(Buffer.alloc(32))).toThrow('ENCRYPTION_UNAVAILABLE');
    });

    it('rejects Linux basic_text instead of silently weakening protection', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        safeStorage.getSelectedStorageBackend.mockReturnValue('basic_text');
        try {
            const { ElectronSafeStorageDeviceKeyStore } = await import('./DeviceKeyStore');
            expect(new ElectronSafeStorageDeviceKeyStore().status()).toMatchObject({
                available: false,
                reason: 'INSECURE_LINUX_BACKEND'
            });
        } finally {
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        }
    });
});

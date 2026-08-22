import { safeStorage } from 'electron';

export interface DeviceKeyStoreStatus {
    available: boolean;
    provider: string;
    reason?: 'ENCRYPTION_UNAVAILABLE' | 'INSECURE_LINUX_BACKEND';
}

/** Device-bound wrapping boundary; injectable for tests and future platforms. */
export interface DeviceKeyStore {
    status(): DeviceKeyStoreStatus;
    protect(value: Buffer): Buffer;
    unprotect(value: Buffer): Buffer;
}

export class ElectronSafeStorageDeviceKeyStore implements DeviceKeyStore {
    status(): DeviceKeyStoreStatus {
        if (!safeStorage.isEncryptionAvailable()) {
            return { available: false, provider: 'electron-safe-storage', reason: 'ENCRYPTION_UNAVAILABLE' };
        }
        if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
            return { available: false, provider: 'electron-safe-storage', reason: 'INSECURE_LINUX_BACKEND' };
        }
        return { available: true, provider: 'electron-safe-storage' };
    }

    protect(value: Buffer): Buffer {
        this.assertAvailable();
        return safeStorage.encryptString(value.toString('base64'));
    }

    unprotect(value: Buffer): Buffer {
        this.assertAvailable();
        return Buffer.from(safeStorage.decryptString(value), 'base64');
    }

    private assertAvailable(): void {
        const current = this.status();
        if (!current.available) throw new Error(current.reason || 'DEVICE_KEY_UNAVAILABLE');
    }
}

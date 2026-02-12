export { };

declare global {
    interface Window {
        electron: {
            login: (credentials: { username: string, password: string }) => Promise<{ success: boolean; user?: any; error?: string }>;
            checkSetup: () => Promise<{ isSetup: boolean; hasRecovery: boolean }>;
            getRecoveryStatus: () => Promise<{ isSetup: boolean; hasRecovery: boolean; hasBackups: boolean; backups?: any[] }>;
            restoreSystemBackup: (path: string) => Promise<void>;
            setup: (data: any) => Promise<{ success: boolean; recoveryCode?: string; error?: string }>;
            recover: (data: any) => Promise<{ success: boolean; recoveryCode?: string; error?: string }>;
            regenerateRecoveryCode: (password: string) => Promise<{ success: boolean; recoveryCode?: string; error?: string }>;
            db: {
                getPatients: (query: string) => Promise<any[]>;
                savePatient: (patient: any) => Promise<any>;
                deletePatient: (id: number) => Promise<any>;
                getVisits: (patientId: number) => Promise<any[]>;
                getAllVisits: (limit: number) => Promise<any[]>;
                saveVisit: (visit: any) => Promise<any>;
                deleteVisit: (id: number) => Promise<any>;
                getSettings: () => Promise<any>;
                saveSettings: (settings: any) => Promise<any>;
                getDashboardStats: () => Promise<{ totalPatients: number, todayVisits: number }>;
                getDoctors: () => Promise<any[]>;
                saveDoctor: (doctor: any) => Promise<any>;
                deleteDoctor: (id: number) => Promise<any>;
                // Users
                getUsers: () => Promise<any[]>;
                saveUser: (user: any) => Promise<any>;
                deleteUser: (id: number) => Promise<any>;
                updateUserPassword: (data: any) => Promise<any>;
                // Queue
                getQueue: () => Promise<any[]>;
                addToQueue: (data: { patientId: number, priority: number }) => Promise<any>;
                updateQueueStatus: (data: { id: number, status: string }) => Promise<any>;
                updateQueueStatusByPatientId: (data: { patientId: number, status: string }) => Promise<any>;
                removeFromQueue: (id: number) => Promise<any>;
                // Audit
                getAuditLogs: (limit: number) => Promise<any[]>;
            };
            drive: {
                isAuthenticated: () => Promise<boolean>;
                disconnect: () => Promise<{ success: boolean; error?: string }>;
                authenticate: (credentials: { clientId: string, clientSecret: string }) => Promise<any>;
                backup: () => Promise<{ success: boolean; error?: string }>;
                restore: (fileId: string) => Promise<{ success: boolean; restartRequired?: boolean; error?: string }>;
                listBackups: () => Promise<any[]>;
            };
            updater: {
                checkForUpdates: () => Promise<any>;
                quitAndInstall: () => Promise<void>;
                onUpdateAvailable: (callback: (info: any) => void) => void;
                onUpdateDownloaded: (callback: (info: any) => void) => void;
                onDownloadProgress: (callback: (progress: any) => void) => void;
                onUpdateError: (callback: (err: any) => void) => void;
            };
            cloud: {
                getStatus: () => Promise<{ enabled: boolean; clinicId: string | null }>;
                onboard: (data: { name: string; city: string }) => Promise<{ success: boolean; clinicId: string }>;
                toggle: (enabled: boolean) => Promise<void>;
            };
            clipboard: {
                writeText: (text: string) => Promise<boolean>;
            },
            backup: {
                selectPath: () => Promise<string | null>;
                useDefaultPath: () => Promise<string | null>;
                runNow: () => Promise<{ success: boolean; error?: string }>;
                listSystemBackups: () => Promise<any[]>;
            };
            utils: {
                openExternal: (url: string) => Promise<void>;
            };
        };
    }
}

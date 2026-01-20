export { };

declare global {
    interface Window {
        electron: {
            login: (password: string) => Promise<{ success: boolean; error?: string }>;
            db: {
                getPatients: (query: string) => Promise<any[]>;
                savePatient: (patient: any) => Promise<any>;
                deletePatient: (id: number) => Promise<any>;
                getVisits: (patientId: number) => Promise<any[]>;
                saveVisit: (visit: any) => Promise<any>;
                deleteVisit: (id: number) => Promise<any>;
                getSettings: () => Promise<any>;
                saveSettings: (settings: any) => Promise<any>;
                getDashboardStats: () => Promise<{ totalPatients: number, todayVisits: number }>;
                getDoctors: () => Promise<any[]>;
                saveDoctor: (doctor: any) => Promise<any>;
                deleteDoctor: (id: number) => Promise<any>;
            };
            drive: {
                authenticate: () => Promise<boolean>;
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
        };
    }
}

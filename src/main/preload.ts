import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded!');
contextBridge.exposeInMainWorld('electron', {
    login: (password: string) => ipcRenderer.invoke('auth:login', password),
    db: {
        getPatients: (query: string) => ipcRenderer.invoke('db:getPatients', query),
        savePatient: (patient: any) => ipcRenderer.invoke('db:savePatient', patient),
        deletePatient: (id: number) => ipcRenderer.invoke('db:deletePatient', id),
        getVisits: (patientId: number) => ipcRenderer.invoke('db:getVisits', patientId),
        saveVisit: (visit: any) => ipcRenderer.invoke('db:saveVisit', visit),
        deleteVisit: (id: number) => ipcRenderer.invoke('db:deleteVisit', id),
        getSettings: () => ipcRenderer.invoke('db:getSettings'),
        saveSettings: (settings: any) => ipcRenderer.invoke('db:saveSettings', settings),
        getDashboardStats: () => ipcRenderer.invoke('db:getDashboardStats'),
        getDoctors: () => ipcRenderer.invoke('db:getDoctors'),
        saveDoctor: (doctor: any) => ipcRenderer.invoke('db:saveDoctor', doctor),
        deleteDoctor: (id: number) => ipcRenderer.invoke('db:deleteDoctor', id)
    },
    drive: {
        authenticate: () => ipcRenderer.invoke('drive:authenticate'),
        backup: () => ipcRenderer.invoke('drive:backup'),
        restore: (fileId: string) => ipcRenderer.invoke('drive:restore', fileId),
        listBackups: () => ipcRenderer.invoke('drive:listBackups')
    },
    updater: {
        checkForUpdates: () => ipcRenderer.invoke('updater:check'),
        quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
        onUpdateAvailable: (callback: (info: any) => void) => {
            ipcRenderer.on('update-available', (_, info) => callback(info));
        },
        onUpdateDownloaded: (callback: (info: any) => void) => {
            ipcRenderer.on('update-downloaded', (_, info) => callback(info));
        },
        onDownloadProgress: (callback: (progress: any) => void) => {
            ipcRenderer.on('download-progress', (_, progress) => callback(progress));
        },
        onUpdateError: (callback: (err: any) => void) => {
            ipcRenderer.on('update-error', (_, err) => callback(err));
        }
    }
});

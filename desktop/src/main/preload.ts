import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded!');
contextBridge.exposeInMainWorld('electron', {
    login: (password: string) => ipcRenderer.invoke('auth:login', password),
    checkSetup: () => ipcRenderer.invoke('auth:checkSetup'),
    getRecoveryStatus: () => ipcRenderer.invoke('auth:getRecoveryStatus'),
    restoreSystemBackup: (path: string) => ipcRenderer.invoke('auth:restoreSystemBackup', path),
    setup: (data: any) => ipcRenderer.invoke('auth:setup', data),
    recover: (data: any) => ipcRenderer.invoke('auth:recover', data),
    regenerateRecoveryCode: (password: string) => ipcRenderer.invoke('auth:regenerateRecoveryCode', { password }),
    // ...
    backup: {
        selectPath: () => ipcRenderer.invoke('backup:selectPath'),
        useDefaultPath: () => ipcRenderer.invoke('backup:useDefaultPath'),
        runNow: () => ipcRenderer.invoke('backup:runNow'),
        listSystemBackups: () => ipcRenderer.invoke('backup:listSystemBackups')
    },
    db: {
        getPatients: (query: string) => ipcRenderer.invoke('db:getPatients', query),
        getPatientById: (id: number) => ipcRenderer.invoke('db:getPatientById', id),
        savePatient: (patient: any) => ipcRenderer.invoke('db:savePatient', patient),
        deletePatient: (id: number) => ipcRenderer.invoke('db:deletePatient', id),
        getVisits: (patientId: number) => ipcRenderer.invoke('db:getVisits', patientId),
        getAllVisits: (limit: number) => ipcRenderer.invoke('db:getAllVisits', limit),
        saveVisit: (visit: any) => ipcRenderer.invoke('db:saveVisit', visit),
        deleteVisit: (id: number) => ipcRenderer.invoke('db:deleteVisit', id),
        getSettings: () => ipcRenderer.invoke('db:getSettings'),
        getPublicSettings: () => ipcRenderer.invoke('db:getPublicSettings'),
        saveSettings: (settings: any) => ipcRenderer.invoke('db:saveSettings', settings),
        getDashboardStats: () => ipcRenderer.invoke('db:getDashboardStats'),
        getDoctors: () => ipcRenderer.invoke('db:getDoctors'),
        getVitals: (patientId: number) => ipcRenderer.invoke('db:getVitals', patientId),
        saveVitals: (vitals: any) => ipcRenderer.invoke('db:saveVitals', vitals),
        // Users
        getUsers: () => ipcRenderer.invoke('db:getUsers'),
        saveUser: (user: any) => ipcRenderer.invoke('db:saveUser', user),
        deleteUser: (id: number) => ipcRenderer.invoke('db:deleteUser', id),
        updateUserPassword: (data: any) => ipcRenderer.invoke('db:updateUserPassword', data),
        // Queue
        getQueue: () => ipcRenderer.invoke('db:getQueue'),
        addToQueue: (data: { patientId: number, priority: number }) => ipcRenderer.invoke('db:addToQueue', data),
        updateQueueStatus: (data: { id: number, status: string }) => ipcRenderer.invoke('db:updateQueueStatus', data),
        updateQueueStatusByPatientId: (data: { patientId: number, status: string }) => ipcRenderer.invoke('db:updateQueueStatusByPatientId', data),
        removeFromQueue: (id: number) => ipcRenderer.invoke('db:removeFromQueue', id),
        // Audit
        getAuditLogs: (limit: number) => ipcRenderer.invoke('db:getAuditLogs', limit),
        // Appointment Requests
        getAppointmentRequests: () => ipcRenderer.invoke('db:getAppointmentRequests'),
        updateAppointmentRequestStatus: (data: { id: string, status: string }) => ipcRenderer.invoke('db:updateAppointmentRequestStatus', data),
        // Appointments
        getAppointments: (date: string) => ipcRenderer.invoke('db:getAppointments', date),
        saveAppointment: (appt: any) => ipcRenderer.invoke('db:saveAppointment', appt)
    },
    drive: {
        isAuthenticated: () => ipcRenderer.invoke('drive:isAuthenticated'),
        disconnect: () => ipcRenderer.invoke('drive:disconnect'),
        authenticate: (credentials: { clientId: string, clientSecret: string }) => ipcRenderer.invoke('drive:authenticate', credentials),
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
    },
    cloud: {
        getStatus: () => ipcRenderer.invoke('cloud:getStatus'),
        onboard: (data: { name: string, city: string }) => ipcRenderer.invoke('cloud:onboard', data),
        toggle: (enabled: boolean) => ipcRenderer.invoke('cloud:toggle', enabled),
        syncNow: () => ipcRenderer.invoke('cloud:syncNow'),
        getPublishedSlots: (date: string) => ipcRenderer.invoke('cloud:getPublishedSlots', date)
    },
    clipboard: {
        writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
    },

    utils: {
        openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url),
        getLocalIp: () => ipcRenderer.invoke('utils:getLocalIp')
    }
});

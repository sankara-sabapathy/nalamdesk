import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class CloudService {

    async publishSlots(slots: { date: string, time: string }[], dates: string[]) {
        if ((window as any).electron) {
            return (window as any).electron.cloud.publishSlots(slots, dates);
        }
    }

    async getPublishedSlots(date: string) {
        if ((window as any).electron) {
            return (window as any).electron.cloud.getPublishedSlots(date);
        }
        return [];
    }

    async getAppointmentRequests() {
        if ((window as any).electron) {
            return (window as any).electron.db.getAppointmentRequests();
        }
        return [];
    }

    async updateRequestStatus(id: string, status: string) {
        if ((window as any).electron) {
            return (window as any).electron.db.updateAppointmentRequestStatus({ id, status });
        }
    }

    async syncNow() {
        if ((window as any).electron) {
            return (window as any).electron.cloud.syncNow();
        }
    }

    async saveAppointment(appt: any) {
        if ((window as any).electron) {
            return (window as any).electron.db.saveAppointment(appt);
        }
    }

    async getAppointments(date: string) {
        if ((window as any).electron) {
            return (window as any).electron.db.getAppointments(date);
        }
        return [];
    }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// In production, this Angular app is served by the same server hosting the API.
// So relative path works perfectly.
const API_BASE = '/api/v1';

export interface Clinic {
    id: string;
    name: string;
    city: string;
    specialty?: string;
    last_seen: string;
}

export interface Slot {
    id: string;
    clinic_id: string;
    date: string;
    time: string;
    status: 'AVAILABLE' | 'HELD' | 'BOOKED';
}

export interface BookingRequest {
    clinicId?: string;
    slotId?: string;
    patientName: string;
    phone: string;
    reason?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    constructor(private http: HttpClient) { }

    getClinics(): Observable<Clinic[]> {
        return this.http.get<Clinic[]>(`${API_BASE}/clinics`);
    }

    getSlots(clinicId: string): Observable<Slot[]> {
        return this.http.get<Slot[]>(`${API_BASE}/slots/${clinicId}`);
    }

    bookAppointment(data: BookingRequest): Observable<any> {
        return this.http.post(`${API_BASE}/book`, data);
    }
}

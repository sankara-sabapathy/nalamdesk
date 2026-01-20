import { Injectable, NgZone } from '@angular/core';

export interface Patient {
  id?: number;
  uuid?: string;
  name: string;
  mobile: string;
  age: number;
  gender: string;
  address: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {

  constructor(private ngZone: NgZone) { }

  async getPatients(query: string = ''): Promise<Patient[]> {
    return await window.electron.db.getPatients(query);
  }

  async savePatient(patient: Patient): Promise<any> {
    return await window.electron.db.savePatient(patient);
  }
}

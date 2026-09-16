---
sidebar_position: 3
---

# Clinic Operations

This guide covers the daily workflows for Receptionists and Doctors.

## Patient Registration (Receptionist)
1. Navigate to **Patients**.
2. Click **+ New Patient**.
3. Enter details: **Name**, **Age/Gender**, **Mobile Number**.
4. Click **Save**.

## Managing the Queue
The **Queue** is the heart of the clinic's flow.

### Adding Patient to Queue
1. From the **Patient List**, click the **Add to Queue** icon next to a patient.
2. Select Priority: **Normal** or **Emergency**.
3. The patient will appear in the **Waiting** list.

### Changing Status
- **Mark as In-Consult**: When the doctor calls the patient, change status to `In-Consult`.
- **Mark as Completed**: Automatically updated when the doctor finishes the prescription.

### Recording Vitals (Triage / Pre-Consultation)
Staff (nurse, receptionist, or doctor) can record vitals for any patient waiting in the queue:
1. Click the **Record Vitals** (heartbeat) icon on the patient card in the Queue.
2. Enter the clinical observations:
   - **Blood Pressure**: Both Systolic and Diastolic must be entered together, with Systolic strictly greater than Diastolic (e.g., 120/80 mmHg).
   - **Pulse**: Heart rate in beats per minute (30–250 bpm).
   - **Temperature**: Measured in °F (50–115 °F).
   - **Weight & Height**: Measured in kg and cm; BMI is automatically calculated.
   - **Observation Time**: Defaults to current time or can be adjusted to when measured.
3. At least one vital sign is required to save. Blank submissions are rejected.
4. Click **Save Vitals**. The observations persist durably linked to the queue entry and will automatically attach to the consultation when the doctor opens the visit.

## Consultation (Doctor)
1. Go to **Queue** or **Dashboard**.
2. Click on a patient in the **Waiting** or **In-Consult** list.
3. **Vitals**:
   - Vitals recorded during queue triage automatically appear in the patient snapshot pill and can be auto-filled into Objective notes.
   - The doctor can click **Edit Vitals** to review or update measurements. Updating existing vitals creates an amended observation with an audit trail and reason, preserving history.
4. **Diagnosis**: Enter clinical notes.
5. **Prescription**: 
    - Add medicines (Name, Dosage, Frequency, Duration).
    - The system autocompletes common medicines.
6. **Print**: Generate a PDF prescription.
7. **Save**: Finishing the consult moves the patient to `Completed` status.

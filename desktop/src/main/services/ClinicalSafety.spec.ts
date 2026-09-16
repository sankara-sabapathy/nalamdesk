import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './DatabaseService';

const { DatabaseSync } = require('node:sqlite');

class TestDatabase {
    private readonly sqlite = new DatabaseSync(':memory:');
    readonly name = ':memory:';

    exec(sql: string) { return this.sqlite.exec(sql); }
    prepare(sql: string) { return this.sqlite.prepare(sql); }
    close() { return this.sqlite.close(); }
    pragma(sql: string, options?: { simple?: boolean }) {
        const assignment = sql.match(/^user_version\s*=\s*(\d+)$/);
        if (assignment) {
            this.sqlite.exec(`PRAGMA user_version = ${assignment[1]}`);
            return;
        }
        const row = this.sqlite.prepare(`PRAGMA ${sql}`).get() as any;
        return options?.simple ? row?.user_version : row;
    }
    transaction<T extends (...args: any[]) => any>(operation: T): T & { immediate: T } {
        const run = ((...args: any[]) => {
            this.sqlite.exec('BEGIN IMMEDIATE');
            try {
                const value = operation(...args);
                this.sqlite.exec('COMMIT');
                return value;
            } catch (error) {
                this.sqlite.exec('ROLLBACK');
                throw error;
            }
        }) as T & { immediate: T };
        run.immediate = run;
        return run;
    }
}

describe('Clinical Safety, Practitioner Provenance & Actionable Triage', () => {
    let db: any;
    let service: DatabaseService;

    beforeEach(async () => {
        db = new TestDatabase();
        db.exec('PRAGMA foreign_keys = ON');
        service = new DatabaseService();
        service.setDb(db);
        await service.migrate();

        // Doctors, nurse, admin
        db.prepare("INSERT INTO users (id, username, role, name, license_number, specialty, active) VALUES (10, 'dr_smith', 'doctor', 'Dr. Smith', 'MED-12345', 'Internal Medicine', 1)").run();
        db.prepare("INSERT INTO users (id, username, role, name, license_number, specialty, active) VALUES (11, 'dr_jones', 'doctor', 'Dr. Jones', 'MED-67890', 'Cardiology', 1)").run();
        db.prepare("INSERT INTO users (id, username, role, name, active) VALUES (20, 'nurse_nancy', 'nurse', 'Nurse Nancy', 1)").run();
        db.prepare("INSERT INTO users (id, username, role, name, active) VALUES (99, 'admin', 'admin', 'System Admin', 1)").run();

        // Patients
        db.prepare("INSERT INTO patients (id, uuid, name, mobile, age, gender) VALUES (1, 'p-1', 'Alice Green', '9876543210', 30, 'female')").run();
        db.prepare("INSERT INTO patients (id, uuid, name, mobile, age, gender) VALUES (2, 'p-2', 'Bob Brown', '9876543211', 45, 'male')").run();
    });

    afterEach(() => db.close());

    function queuePatient(patientId: number, options?: any) {
        return service.addToQueue(patientId, options, 20);
    }

    describe('Track A: Practitioner Provenance (Issue #11)', () => {
        it('requires an active licensed doctor to begin consultation', () => {
            const q = queuePatient(1);
            const qId = Number(q.lastInsertRowid);

            // Admin cannot begin encounter without doctorId
            expect(() => service.beginConsultation({ patientId: 1, queueEntryId: qId, startRequestId: 'req-admin' }, 99))
                .toThrow('Clinical authoring requires an active licensed practitioner');

            // Doctor can begin encounter
            const enc = service.beginConsultation({ patientId: 1, queueEntryId: qId, startRequestId: 'req-doc' }, 10);
            expect(enc.doctor_id).toBe(10);
            expect(enc.author_id).toBe(10);
            expect(enc.doctor_license).toMatchObject({
                name: 'Dr. Smith',
                license_number: 'MED-12345',
                specialty: 'Internal Medicine'
            });
        });

        it('supports delegated authoring by nurse with responsible doctorId', () => {
            const q = queuePatient(1);
            const qId = Number(q.lastInsertRowid);

            // Nurse starting encounter on behalf of Dr. Jones (11)
            const enc = service.beginConsultation({ patientId: 1, queueEntryId: qId, doctorId: 11, startRequestId: 'req-nurse' }, 20);
            expect(enc.doctor_id).toBe(11);
            expect(enc.author_id).toBe(20);
            expect(enc.doctor_license).toMatchObject({
                name: 'Dr. Jones',
                license_number: 'MED-67890'
            });

            // Author (nurse) and responsible doctor can save consultation progress
            const saved = service.saveConsultationProgress({
                encounterId: enc.id,
                visit: { symptoms: 'Sore throat and cough' }
            }, 20);
            expect(saved.symptoms).toBe('Sore throat and cough');

            // Unrelated doctor cannot access
            expect(() => service.saveConsultationProgress({ encounterId: enc.id, visit: {} }, 10))
                .toThrow('Only the responsible practitioner can access this encounter');
        });

        it('rejects access if practitioner is deactivated', () => {
            const q = queuePatient(1);
            const qId = Number(q.lastInsertRowid);
            const enc = service.beginConsultation({ patientId: 1, queueEntryId: qId, startRequestId: 'req-active' }, 10);

            // Deactivate Dr. Smith
            db.prepare('UPDATE users SET active = 0 WHERE id = 10').run();
            expect(() => service.saveConsultationProgress({ encounterId: enc.id, visit: { symptoms: 'fever' } }, 10))
                .toThrow('User is deactivated');
        });
    });

    describe('Track B: Longitudinal Allergies, Conditions & Prescribing Conflicts (Issue #15)', () => {
        it('performs CRUD on allergies and returns active sorted by severity', () => {
            service.saveAllergy({
                patient_id: 1,
                substance: 'Penicillin',
                severity: 'life-threatening',
                reaction: 'Anaphylaxis',
                status: 'active'
            }, 10);

            service.saveAllergy({
                patient_id: 1,
                substance: 'Aspirin',
                severity: 'mild',
                reaction: 'Upset stomach',
                status: 'active'
            }, 10);

            const allergies = service.getAllergies(1);
            expect(allergies).toHaveLength(2);
            // Penicillin (life-threatening) appears before Aspirin (mild)
            expect(allergies[0].substance).toBe('Penicillin');
            expect(allergies[0].severity).toBe('life-threatening');
            expect(allergies[1].substance).toBe('Aspirin');

            // Delete allergy
            service.deleteAllergy(allergies[1].id, 10);
            expect(service.getAllergies(1)).toHaveLength(1);
        });

        it('detects prescription conflict with active allergy and blocks unless override reason provided', () => {
            service.saveAllergy({
                patient_id: 1,
                substance: 'Amoxicillin',
                severity: 'severe',
                status: 'active'
            }, 10);

            const q = queuePatient(1);
            const enc = service.beginConsultation({ patientId: 1, queueEntryId: Number(q.lastInsertRowid), startRequestId: 'req-allergy' }, 10);

            // Saving prescription containing Amoxicillin without override reason should throw
            expect(() => service.saveConsultationProgress({
                encounterId: enc.id,
                visit: {
                    prescription: [{ medicine: 'Amoxicillin 500mg', dosage: '1 tab', frequency: 'TID' }]
                }
            }, 10)).toThrow(/conflicting with active allergy 'Amoxicillin'/);

            // Providing override reason allows it to succeed
            const saved = service.saveConsultationProgress({
                encounterId: enc.id,
                visit: {
                    prescription: [{ medicine: 'Amoxicillin 500mg', dosage: '1 tab', frequency: 'TID' }],
                    allergy_override_reason: 'Patient confirmed prior desensitization therapy'
                }
            }, 10);
            expect(saved.allergy_override_reason).toBe('Patient confirmed prior desensitization therapy');
        });

        it('auto-syncs prescribed medications into patient_medications upon completion', () => {
            const q = queuePatient(1);
            const enc = service.beginConsultation({ patientId: 1, queueEntryId: Number(q.lastInsertRowid), startRequestId: 'req-finish' }, 10);

            service.completeConsultation({
                encounterId: enc.id,
                visit: {
                    diagnosis: 'Acute Bronchitis',
                    prescription: [
                        { medicine: 'Azithromycin 250mg', dosage: '1 tab', frequency: 'OD' },
                        { medicine: 'Paracetamol 650mg', dosage: '1 tab', frequency: 'SOS' }
                    ]
                }
            }, 10);

            const meds = service.getMedications(1);
            expect(meds).toHaveLength(2);
            expect(meds.some((m: any) => m.medicine_name === 'Azithromycin 250mg')).toBe(true);
            expect(meds.some((m: any) => m.medicine_name === 'Paracetamol 650mg')).toBe(true);
        });

        it('consolidates patient safety context into a single profile', () => {
            service.saveAllergy({
                patient_id: 1,
                substance: 'Sulfa Drugs',
                severity: 'severe',
                status: 'active'
            }, 10);
            service.saveCondition({
                patient_id: 1,
                condition_name: 'Hypertension',
                code: 'I10',
                clinical_status: 'active'
            }, 10);

            const safety = service.getPatientSafetyContext(1);
            expect(safety.has_active_allergies).toBe(true);
            expect(safety.has_life_threatening_allergies).toBe(true);
            expect(safety.active_conditions).toHaveLength(1);
            expect(safety.active_conditions[0].condition_name).toBe('Hypertension');
        });
    });

    describe('Track C: Actionable Urgency, Triage History & Abnormal Vitals (Issue #17 & #53)', () => {
        it('sorts queue by urgency priority (immediate > urgent > priority > routine)', () => {
            service.addToQueue(1, { urgency: 'routine', priority: 1, triage_notes: 'Regular checkup' }, 20);
            service.addToQueue(2, { urgency: 'immediate', priority: 4, triage_notes: 'Severe chest pain' }, 20);

            const queue = service.getQueue();
            expect(queue[0].patient_id).toBe(2);
            expect(queue[0].urgency).toBe('immediate');
            expect(queue[1].patient_id).toBe(1);
            expect(queue[1].urgency).toBe('routine');
        });

        it('records initial triage and logs reassessment in queue_triage_history', () => {
            const added = service.addToQueue(1, { urgency: 'routine', priority: 1, triage_notes: 'Normal walk-in' }, 20);
            const queueId = Number(added.lastInsertRowid);

            // Verify initial triage history
            let history = service.getQueueTriageHistory(queueId);
            expect(history).toHaveLength(1);
            expect(history[0].new_urgency).toBe('routine');

            // Reassess triage to Urgent
            service.reassessQueueTriage(queueId, 'urgent', 'Patient developed acute shortness of breath', 10);

            history = service.getQueueTriageHistory(queueId);
            expect(history).toHaveLength(2);
            expect(history[0].previous_priority).toBe(1);
            expect(history[0].new_urgency).toBe('urgent');
            expect(history[0].reason).toBe('Patient developed acute shortness of breath');
            expect(history[0].assessor_name).toBe('Dr. Smith');

            const queue = service.getQueue();
            expect(queue[0].urgency).toBe('urgent');
            expect(queue[0].priority).toBe(3);
        });

        it('flags queue card with abnormal vitals alerts', () => {
            const added = service.addToQueue(1, { urgency: 'routine', priority: 1 }, 20);
            const queueId = Number(added.lastInsertRowid);

            // Record abnormal vitals linked to this queue entry
            service.saveVitals({
                patient_id: 1,
                queue_entry_id: queueId,
                systolic_bp: 175,
                diastolic_bp: 105,
                pulse: 125,
                temperature: 103.5
            }, 20);

            const queue = service.getQueue();
            expect(queue[0].has_abnormal_vitals).toBe(true);
            expect(queue[0].vitals_alerts.length).toBeGreaterThanOrEqual(3);
            expect(queue[0].vitals_alerts.some((a: string) => a.includes('Critical Systolic BP'))).toBe(true);
            expect(queue[0].vitals_alerts.some((a: string) => a.includes('Fever'))).toBe(true);
        });

        it('disallows reassessing completed queue entries', () => {
            const added = service.addToQueue(1, { urgency: 'routine', priority: 1 }, 20);
            const queueId = Number(added.lastInsertRowid);

            const enc = service.beginConsultation({ patientId: 1, queueEntryId: queueId, startRequestId: 'req-comp' }, 10);
            service.completeConsultation({ encounterId: enc.id, visit: { diagnosis: 'Done' } }, 10);

            expect(() => service.reassessQueueTriage(queueId, 'immediate', 'Too late', 10))
                .toThrow('Cannot reassess triage for completed queue entry');
        });
    });
});

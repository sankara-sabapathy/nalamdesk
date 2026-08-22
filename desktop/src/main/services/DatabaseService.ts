import { MIGRATIONS } from '../schema/migrations';

export class DatabaseService {
    private db: any;

    setDb(db: any) {
        this.db = db;
    }

    private async createBackup(dbName: string) {
        if (!dbName || dbName === ':memory:') return;

        const backupName = `${dbName}.bak`;
        // Delete existing backup to prevent "incompatible source and target" errors 
        // if the schema/key changed since the last backup.
        try {
            const fs = require('node:fs');
            if (fs.existsSync(backupName)) {
                fs.unlinkSync(backupName);
                console.log(`[DB] Deleted old backup: ${backupName}`);
            }
        } catch (e) {
            console.warn('[DB] Failed to delete old backup:', e);
        }

        console.log(`[DB] Backing up manual snapshot to ${backupName}...`);
        // Use VACUUM INTO for encrypted DB safety
        try {
            this.db.prepare(`VACUUM INTO ?`).run(backupName);
            console.log('[DB] Backup (VACUUM INTO) complete.');
        } catch (e: any) {
            console.warn('[DB] VACUUM INTO failed during migration backup, trying fallback...', e);
            await this.db.backup(backupName);
        }
    }

    async migrate(options: { skipBackup?: boolean } = {}) {
        if (!this.db) throw new Error('DB not initialized');

        // Safety: Backup before migrating
        if (!options.skipBackup) {
            try {
                await this.createBackup(this.db.name);
            } catch (e) {
                console.error('[DB] Backup failed! Proceeding with caution...', e);
                // Optional: Throw if backup is critical? For now, log and proceed (or user can't login).
            }
        }

        // Check Version
        const currentVersion = this.db.pragma('user_version', { simple: true });
        console.log(`[DB] Current Schema Version: ${currentVersion}`);

        // Transactional Migration
        const runMigrations = this.db.transaction(() => {
            for (const migration of MIGRATIONS) {
                if (migration.version > currentVersion) {
                    console.log(`[DB] Migrating to v${migration.version}...`);
                    migration.up(this.db);
                    this.db.pragma(`user_version = ${migration.version}`);
                }
            }
        });

        try {
            runMigrations();
            console.log(`[DB] Migration check complete. Version: ${this.db.pragma('user_version', { simple: true })}`);
        } catch (err) {
            console.error('[DB] MIGRATION FAILED! Rolling back transaction.', err);
            throw err; // Critical failure
        }
    }

    async backupDatabase(destPath: string) {
        if (!this.db) throw new Error('DB not initialized');
        console.log(`[DB] Starting backup to ${destPath}...`);

        // Remove destination if exists (VACUUM INTO requires non-existent target)
        const fs = require('node:fs');
        if (fs.existsSync(destPath)) {
            try { fs.unlinkSync(destPath); } catch (e) { console.warn('Failed to delete existing backup target', e); }
        }

        try {
            // Use VACUUM INTO for encrypted DB compatibility
            this.db.prepare(`VACUUM INTO ?`).run(destPath);
            console.log(`[DB] Backup to ${destPath} completed.`);
        } catch (e: any) {
            console.error('[DB] VACUUM INTO failed, trying fallback to backup API...', e);
            // Fallback (might fail with same error, but worth a shot if VACUUM fails for other reasons)
            await this.db.backup(destPath);
        }
    }

    async ensureAdminUser(password: string) {
        const admin = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!admin) {
            const hash = await import('argon2').then(a => a.hash(password));
            this.db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'Administrator');
            console.log('Default admin user created.');
        } else {
            // Existing login credentials are never changed by provisioning or
            // database-key operations. CredentialRotationService owns changes.
            console.log('Administrator already provisioned; login password preserved.');
        }

        // Migration: Add doctor fields to users if missing
        try { this.db.exec(`ALTER TABLE users ADD COLUMN specialty TEXT`); } catch (e) { }
        try { this.db.exec(`ALTER TABLE users ADD COLUMN license_number TEXT`); } catch (e) { }
    }

    // ... existing Settings methods ...

    // Users
    getUsers() {
        return this.db.prepare('SELECT id, username, role, name, active, created_at, designation, mobile, email, joining_date FROM users ORDER BY created_at DESC').all();
    }

    getUserByUsername(username: string) {
        return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    async validateUser(username: string, passwordTry: string) {
        const user = this.getUserByUsername(username);
        if (!user) { console.log('[DB] User not found:', username); return { success: false, error: 'INVALID_CREDENTIALS' }; }
        if (user.active !== 1) { console.log('[DB] User inactive:', username, user.active); return { success: false, error: 'ACCESS_DENIED' }; }

        const argon2 = await import('argon2');
        try {
            if (await argon2.verify(user.password, passwordTry)) {
                return {
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        name: user.name,
                        password_reset_required: user.password_reset_required
                    }
                };
            }
        } catch (e) {
            console.error('Password verify failed', e);
        }
        return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    async saveUser(user: any, actingUserId?: number) {
        const argon2 = await import('argon2');

        // Prepare optional fields to ensure they aren't undefined
        const safeUser = {
            specialty: null, license_number: null,
            mobile: null, email: null, designation: null, joining_date: null,
            address: null, emergency_contact_name: null, emergency_contact_phone: null,
            password_reset_required: 0,
            active: 1,
            ...user
        };

        const result = user.id
            ? await this.updateExistingUser(safeUser, user, actingUserId)
            : await this.insertNewUser(safeUser, argon2, actingUserId);

        return result;
    }

    private async updateExistingUser(safeUser: any, user: any, actingUserId?: number) {
        const existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        if (!existing) throw new Error('User not found');
        if (Object.prototype.hasOwnProperty.call(user, 'password')) {
            throw new Error('GENERIC_PASSWORD_CHANGE_FORBIDDEN');
        }

        const query = this.buildUpdateQuery();
        const result = this.db.prepare(query).run(safeUser);

        if (actingUserId) {
            this.logAudit('USER_UPDATE', 'users', user.id, actingUserId, `Updated user ${user.username}`);
        }
        return result;
    }

    private buildUpdateQuery(): string {
        const baseCols = `role = @role, name = @name, active = @active, specialty = @specialty, license_number = @license_number,
            mobile = @mobile, email = @email, designation = @designation, joining_date = @joining_date,
            address = @address, emergency_contact_name = @emergency_contact_name, emergency_contact_phone = @emergency_contact_phone`;

        return `UPDATE users SET ${baseCols} WHERE id = @id`;
    }

    private async insertNewUser(safeUser: any, argon2: any, actingUserId?: number) {
        if (!safeUser.password) throw new Error('Password required for new user');

        console.log(`[DB] Creating user ${safeUser.username}`);
        safeUser.password = await argon2.hash(safeUser.password);
        if (safeUser.role) safeUser.role = safeUser.role.toLowerCase();

        // New users always require password reset if created by Admin
        safeUser.password_reset_required = 1;

        const result = this.db.prepare(`
            INSERT INTO users(
                username, password, role, name, active, specialty, license_number,
                mobile, email, designation, joining_date, address, emergency_contact_name, emergency_contact_phone,
                password_reset_required
            )
            VALUES(
                @username, @password, @role, @name, @active, @specialty, @license_number,
                @mobile, @email, @designation, @joining_date, @address, @emergency_contact_name, @emergency_contact_phone,
                @password_reset_required
            )
        `).run(safeUser);

        if (actingUserId) {
            this.logAudit('USER_CREATE', 'users', result.lastInsertRowid, actingUserId, `Created user ${safeUser.username}`);
        }
        return result;
    }

    deleteUser(id: number, actingUserId?: number) {
        // Prevent deleting the admin user
        const user = this.db.prepare('SELECT username FROM users WHERE id = ?').get(id);
        if (user?.username === 'admin') {
            throw new Error('Cannot delete the admin user.');
        }

        // Soft delete preferred? For now we hard delete as per interface, 
        // but normally we should set active=0. 
        // However, 'active' flag usage in getDoctors/validateUser suggests soft delete support.
        // Let's switch to proper soft delete or keep hard delete but audit it.
        // User request implied "Deactivating".
        // Let's do Soft Delete if possible or stick to hard delete for now but log it.
        // Actually, let's allow 'deactivation' via saveUser (active=0).
        // This deleteUser method is likely the "Permanent Delete" button.
        const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (actingUserId) {
            this.logAudit('USER_DELETE', 'users', id, actingUserId, `Deleted user ${id}`);
        }
        return result;
    }

    // ... existing methods ...
    getSettings() {
        return this.db.prepare('SELECT * FROM settings LIMIT 1').get();
    }

    // ... (existing code)

    getPublicSettings() {
        return this.db.prepare('SELECT clinic_name, doctor_name, logo_path, cloud_enabled FROM settings LIMIT 1').get();
    }

    // RBAC
    getPermissions(role: string): string[] {
        const result = this.db.prepare('SELECT permissions FROM roles WHERE name = ?').get(role);
        if (result && result.permissions) {
            try { return JSON.parse(result.permissions); } catch (e) { return []; }
        }
        return [];
    }

    getAllRoles() {
        return this.db.prepare('SELECT * FROM roles').all().map((r: any) => {
            try {
                return {
                    name: r.name,
                    permissions: JSON.parse(r.permissions)
                };
            } catch (e) {
                console.warn(`[DB] Failed to parse permissions for role ${r.name}`, e);
                return { name: r.name, permissions: [] };
            }
        });
    }

    saveRole(name: string, permissions: string[]) {
        const json = JSON.stringify(permissions);
        return this.db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET permissions = excluded.permissions').run(name, json);
    }

    saveSettings(settings: any) {
        // ... (existing code)
        const existing = this.getSettings();

        // Allowed columns whitelist to prevent SQL injection
        const ALLOWED_COLUMNS = [
            'clinic_name', 'doctor_name', 'logo_path', 'license_key',
            'drive_tokens', 'cloud_clinic_id', 'cloud_api_key', 'cloud_enabled',
            'drive_client_id', 'drive_client_secret', 'local_backup_path'
        ];

        // Filter incoming settings to only allowed columns
        const validKeys = Object.keys(settings).filter(k => ALLOWED_COLUMNS.includes(k));

        if (validKeys.length === 0) return; // Nothing to update/insert

        if (existing) {
            // Build dynamic update query using whitelisted keys
            const setClause = validKeys.map(k => `${k} = @${k}`).join(', ');
            // We must pass only the valid properties to .run() to match the placeholders
            const params: any = {};
            validKeys.forEach(k => params[k] = settings[k]);

            this.db.prepare(`UPDATE settings SET ${setClause}`).run(params);
        } else {
            // First insert
            const placeholders = validKeys.map(k => `@${k}`).join(', ');
            const cols = validKeys.join(', ');

            const params: any = {};
            validKeys.forEach(k => params[k] = settings[k]);

            this.db.prepare(`INSERT INTO settings(${cols}) VALUES(${placeholders})`).run(params);
        }
    }

    getDashboardStats() {
        const totalPatients = this.db.prepare('SELECT count(*) as count FROM patients').get().count;
        // Today's visits: date >= start of day
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = this.db.prepare("SELECT count(*) as count FROM visits WHERE date(date) = ? AND status = 'finished'").get(today).count;
        return { totalPatients, todayVisits };
    }

    // Doctors
    getDoctors() {
        return this.db.prepare(`SELECT * FROM users WHERE role = 'doctor' AND active = 1`).all();
    }

    // Patients
    getPatients(query: string = '') {
        if (!query) {
            return this.db.prepare('SELECT * FROM patients ORDER BY created_at DESC LIMIT 50').all();
        }
        const search = `%${query.trim()}%`;
        return this.db.prepare(`
        SELECT * FROM patients 
      WHERE name LIKE ? OR mobile LIKE ?
            ORDER BY created_at DESC
                `).all(search, search);
    }

    getPatientById(id: number) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    }

    savePatient(patientData: any) {
        // Ensure all fields exist for named parameters
        const defaults = {
            dob: null, blood_group: null, email: null,
            emergency_contact_name: null, emergency_contact_mobile: null,
            street: null, city: null, state: null, zip_code: null,
            insurance_provider: null, policy_number: null,
            address: '', age: 0, gender: 'Unknown', mobile: '', name: ''
        };

        const patient = { ...defaults, ...patientData };

        if (patient.id) {
            return this.db.prepare(`
        UPDATE patients SET
            name = @name,
            mobile = @mobile,
            age = @age,
            gender = @gender,
            address = @address,
            dob = @dob,
            blood_group = @blood_group,
            email = @email,
            emergency_contact_name = @emergency_contact_name,
            emergency_contact_mobile = @emergency_contact_mobile,
            street = @street,
            city = @city,
            state = @state,
            zip_code = @zip_code,
            insurance_provider = @insurance_provider,
            policy_number = @policy_number
        WHERE id = @id
            `).run(patient);
        } else {
            if (!patient.uuid) {
                patient.uuid = crypto.randomUUID();
            }
            return this.db.prepare(`
        INSERT INTO patients(
            uuid, name, mobile, age, gender, address, 
            dob, blood_group, email, emergency_contact_name, emergency_contact_mobile,
            street, city, state, zip_code, insurance_provider, policy_number
        )
        VALUES(
            @uuid, @name, @mobile, @age, @gender, @address,
            @dob, @blood_group, @email, @emergency_contact_name, @emergency_contact_mobile,
            @street, @city, @state, @zip_code, @insurance_provider, @policy_number
        )
            `).run(patient);
        }
    }

    // Delete Patient (and their visits)
    deletePatient(id: number) {
        const remove = this.db.transaction(() => {
            const active = this.db.prepare("SELECT id FROM visits WHERE patient_id = ? AND status = 'in-progress'").get(id);
            if (active) throw new Error('Cannot delete a patient with an active encounter');
            this.db.prepare('DELETE FROM visits WHERE patient_id = ?').run(id);
            return this.db.prepare('DELETE FROM patients WHERE id = ?').run(id);
        });
        return remove();
    }

    // Visits
    getVisits(patientId: number) {
        // Updated to include vitals using a simple strategy: Fetch visits, then for each, try to get vitals?
        // OR better: LEFT JOIN vitals on visit_id.
        // NOTE: if multiple vitals exist for a visit (unlikely in current app flow, but possible), this might duplicate rows.
        // Current flow: 1 Visit = 1 Vital entry (usually).

        const visits = this.db.prepare(`
            SELECT 
                v.*, 
                d.name as doctor_name,
                vit.id as vital_id,
                vit.systolic_bp,
                vit.diastolic_bp,
                vit.pulse,
                vit.temperature,
                vit.weight,
                vit.bmi,
                vit.spo2
            FROM visits v 
            LEFT JOIN users d ON v.doctor_id = d.id 
            LEFT JOIN vitals vit ON vit.visit_id = v.id
            WHERE v.patient_id = ? AND v.status = 'finished'
            ORDER BY v.date DESC
        `).all(patientId);

        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : [],
            // Group vitals into a nested object if they exist
            vitals: v.vital_id ? {
                systolic_bp: v.systolic_bp,
                diastolic_bp: v.diastolic_bp,
                pulse: v.pulse,
                temperature: v.temperature,
                weight: v.weight,
                bmi: v.bmi,
                spo2: v.spo2
            } : null
        }));
    }

    getAllVisits(limit: number = 50) {
        const visits = this.db.prepare(`
            SELECT v.*, p.name as patient_name, d.name as doctor_name 
            FROM visits v 
            JOIN patients p ON v.patient_id = p.id
            LEFT JOIN users d ON v.doctor_id = d.id 
            WHERE v.status = 'finished'
            ORDER BY v.date DESC
            LIMIT ?
        `).all(limit);
        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : []
        }));
    }

    deleteVisit(id: number) {
        const existing = this.db.prepare('SELECT status FROM visits WHERE id = ?').get(id);
        if (existing?.status === 'in-progress') throw new Error('Active encounters cannot be deleted');
        return this.db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    }

    saveVisit(visit: any) {
        if (!visit.id) {
            throw new Error('New encounters must be created with beginConsultation');
        }
        const data = {
            id: Number(visit.id),
            diagnosis: visit.diagnosis ?? '',
            prescription_json: JSON.stringify(visit.prescription || []),
            amount_paid: Number(visit.amount_paid || 0),
            symptoms: visit.symptoms ?? '',
            examination_notes: visit.examination_notes ?? '',
            diagnosis_type: visit.diagnosis_type ?? ''
        };

        const existing = this.db.prepare('SELECT status FROM visits WHERE id = ?').get(visit.id);
        if (existing?.status === 'in-progress') throw new Error('Use consultation progress commands for active encounters');
        return this.db.prepare(`
            UPDATE visits SET
                diagnosis = @diagnosis,
                prescription_json = @prescription_json,
                amount_paid = @amount_paid,
                symptoms = @symptoms,
                examination_notes = @examination_notes,
                diagnosis_type = @diagnosis_type
            WHERE id = @id
            `).run(data);
    }

    /**
     * Starts (or resumes) exactly one encounter for an exact queue episode.
     * startRequestId makes a lost-response retry return the original encounter.
     */
    beginConsultation(input: any, actingUserId: number) {
        const patientId = Number(input?.patientId);
        const queueEntryId = Number(input?.queueEntryId);
        const startRequestId = String(input?.startRequestId || '').trim();
        if (!Number.isInteger(patientId) || patientId <= 0 || !Number.isInteger(queueEntryId) || queueEntryId <= 0 || !startRequestId) {
            throw new Error('patientId, queueEntryId, and startRequestId are required');
        }

        const begin = this.db.transaction(() => {
            const retried = this.getStartRequest(startRequestId);
            if (retried) {
                return this.validateStartRetry(retried, {
                    operation: 'begin', patientId, queueEntryId, actingUserId
                });
            }

            const queue = this.db.prepare('SELECT * FROM patient_queue WHERE id = ?').get(queueEntryId);

            if (!queue || queue.patient_id !== patientId || !['waiting', 'in-consult'].includes(queue.status)) {
                throw new Error('Patient does not have an active queue entry');
            }

            const active = this.db.prepare("SELECT * FROM visits WHERE patient_id = ? AND status = 'in-progress'").get(patientId);
            if (active) {
                if (active.queue_entry_id !== queue.id) throw new Error('Patient already has an active encounter for another queue entry');
                this.assertResponsiblePractitioner(active, actingUserId);
                if (queue.status === 'waiting') throw new Error('Active encounter must be resumed explicitly');
                this.recordStartRequest(startRequestId, 'begin', active.id, patientId, queue.id, actingUserId);
                return this.hydrateVisit(active);
            }

            const queueUpdate = this.db.prepare(`
                UPDATE patient_queue SET status = 'in-consult'
                WHERE id = ? AND patient_id = ? AND status = 'waiting'
            `).run(queue.id, patientId);
            if (queue.status === 'waiting' && queueUpdate.changes !== 1) throw new Error('Queue entry is no longer available');

            const result = this.db.prepare(`
                INSERT INTO visits (
                    patient_id, doctor_id, diagnosis, prescription_json, amount_paid,
                    symptoms, examination_notes, diagnosis_type, status,
                    started_at, updated_at, queue_entry_id, start_request_id,
                    start_operation, start_actor_id
                ) VALUES (?, ?, '', '[]', 0, '', '', '', 'in-progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, 'begin', ?)
            `).run(patientId, actingUserId, queue.id, startRequestId, actingUserId);
            this.recordStartRequest(startRequestId, 'begin', Number(result.lastInsertRowid), patientId, queue.id, actingUserId);
            this.logAudit('ENCOUNTER_START', 'visits', result.lastInsertRowid, actingUserId, `Started encounter for queue entry ${queue.id}`);
            return this.getEncounterById(Number(result.lastInsertRowid));
        });

        return begin.immediate();
    }

    getActiveConsultation(patientId: number, actingUserId: number) {
        const row = this.db.prepare(`
            SELECT * FROM visits WHERE patient_id = ? AND status = 'in-progress'
            ORDER BY started_at DESC, id DESC LIMIT 1
        `).get(Number(patientId));
        if (row) this.assertResponsiblePractitioner(row, actingUserId);
        return row ? this.hydrateVisit(row) : null;
    }

    resumeConsultation(input: any, actingUserId: number) {
        const encounterId = Number(input?.encounterId);
        if (!Number.isInteger(encounterId) || encounterId <= 0) throw new Error('encounterId is required');

        const resume = this.db.transaction(() => {
            const encounter = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(encounterId);
            if (!encounter || encounter.status !== 'in-progress' || !encounter.queue_entry_id) {
                throw new Error('Active encounter not found');
            }
            this.assertResponsiblePractitioner(encounter, actingUserId);
            const queue = this.getExactEncounterQueue(encounter, ['waiting', 'in-consult'], 'Encounter queue entry cannot be resumed');
            if (queue.status === 'waiting') {
                const claimed = this.db.prepare(`
                    UPDATE patient_queue SET status = 'in-consult'
                    WHERE id = ? AND patient_id = ? AND status = 'waiting'
                `).run(queue.id, encounter.patient_id);
                if (claimed.changes !== 1) throw new Error('Queue entry is no longer available');
                this.logAudit('ENCOUNTER_RESUME', 'visits', encounterId, actingUserId, `Resumed queue entry ${queue.id}`);
            }
            return this.getEncounterById(encounterId);
        });
        return resume.immediate();
    }

    saveConsultationProgress(input: any, actingUserId: number) {
        const encounterId = Number(input?.encounterId);
        if (!Number.isInteger(encounterId) || encounterId <= 0) throw new Error('encounterId is required');

        const save = this.db.transaction(() => {
            const encounter = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(encounterId);
            if (!encounter) throw new Error('Encounter not found');
            if (encounter.status !== 'in-progress') throw new Error('Completed encounters cannot be changed as progress');
            this.assertResponsiblePractitioner(encounter, actingUserId);
            this.getExactEncounterQueue(encounter, ['in-consult'], 'Encounter queue entry is not in consultation');
            this.updateEncounterClinicalData(encounterId, input.visit);
            this.logAudit('ENCOUNTER_PROGRESS', 'visits', encounterId, actingUserId, 'Saved consultation progress');
            return this.getEncounterById(encounterId);
        });
        return save.immediate();
    }

    completeConsultation(input: any, actingUserId: number) {
        const encounterId = Number(input?.encounterId);
        if (!Number.isInteger(encounterId) || encounterId <= 0) throw new Error('encounterId is required');
        if (!input?.visit) throw new Error('visit is required to complete an encounter');

        const complete = this.db.transaction(() => {
            const encounter = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(encounterId);
            if (!encounter) throw new Error('Encounter not found');
            this.assertResponsiblePractitioner(encounter, actingUserId);
            // A repeated Finish after response loss is a successful no-op.
            if (encounter.status === 'finished') {
                this.getExactEncounterQueue(encounter, ['completed'], 'Completed encounter queue entry is inconsistent');
                return this.hydrateVisit(encounter);
            }
            if (encounter.status !== 'in-progress' || !encounter.queue_entry_id) throw new Error('Encounter is not completable');
            this.getExactEncounterQueue(encounter, ['in-consult'], 'Queue entry is not in consultation');

            const queueUpdate = this.db.prepare(`
                UPDATE patient_queue SET status = 'completed'
                WHERE id = ? AND patient_id = ? AND status = 'in-consult'
            `).run(encounter.queue_entry_id, encounter.patient_id);
            if (queueUpdate.changes !== 1) throw new Error('Queue entry is not in consultation');

            this.updateEncounterClinicalData(encounterId, input.visit);
            this.db.prepare(`
                UPDATE visits SET status = 'finished', completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'in-progress'
            `).run(encounterId);
            this.logAudit('ENCOUNTER_COMPLETE', 'visits', encounterId, actingUserId, `Completed queue entry ${encounter.queue_entry_id}`);
            return this.getEncounterById(encounterId);
        });
        return complete.immediate();
    }

    postponeConsultation(input: any, actingUserId: number) {
        const encounterId = Number(input?.encounterId);
        if (!Number.isInteger(encounterId) || encounterId <= 0) throw new Error('encounterId is required');

        const postpone = this.db.transaction(() => {
            const encounter = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(encounterId);
            if (!encounter || encounter.status !== 'in-progress' || !encounter.queue_entry_id) throw new Error('Active encounter not found');
            this.assertResponsiblePractitioner(encounter, actingUserId);
            this.getExactEncounterQueue(encounter, ['in-consult'], 'Queue entry is not in consultation');
            if (input.visit) this.updateEncounterClinicalData(encounterId, input.visit);
            const result = this.db.prepare(`
                UPDATE patient_queue SET status = 'waiting'
                WHERE id = ? AND patient_id = ? AND status = 'in-consult'
            `).run(encounter.queue_entry_id, encounter.patient_id);
            if (result.changes !== 1) throw new Error('Queue entry is not in consultation');
            this.logAudit('ENCOUNTER_POSTPONE', 'visits', encounterId, actingUserId, `Postponed queue entry ${encounter.queue_entry_id}`);
            return this.getEncounterById(encounterId);
        });
        return postpone.immediate();
    }

    beginNextConsultation(input: any, actingUserId: number) {
        const startRequestId = String(input?.startRequestId || '').trim();
        if (!startRequestId) throw new Error('startRequestId is required');

        const beginNext = this.db.transaction(() => {
            const retried = this.getStartRequest(startRequestId);
            if (retried) {
                return this.validateStartRetry(retried, {
                    operation: 'next', actingUserId
                });
            }

            const queue = this.db.prepare(`
                SELECT q.*
                FROM patient_queue q
                LEFT JOIN visits active
                    ON active.queue_entry_id = q.id AND active.status = 'in-progress'
                WHERE q.status = 'waiting'
                  AND (active.id IS NULL OR active.doctor_id = ?)
                ORDER BY q.priority DESC, q.check_in_time ASC, q.id ASC
                LIMIT 1
            `).get(actingUserId);
            if (!queue) return null;

            const active = this.db.prepare("SELECT * FROM visits WHERE patient_id = ? AND status = 'in-progress'").get(queue.patient_id);
            if (active) {
                if (active.queue_entry_id !== queue.id) throw new Error('Next patient has another active encounter');
                this.assertResponsiblePractitioner(active, actingUserId);
                this.db.prepare("UPDATE patient_queue SET status = 'in-consult' WHERE id = ? AND status = 'waiting'").run(queue.id);
                this.recordStartRequest(startRequestId, 'next', active.id, queue.patient_id, queue.id, actingUserId);
                return this.hydrateVisit(active);
            }

            const claimed = this.db.prepare("UPDATE patient_queue SET status = 'in-consult' WHERE id = ? AND status = 'waiting'").run(queue.id);
            if (claimed.changes !== 1) throw new Error('Next queue entry was already claimed');
            const result = this.db.prepare(`
                INSERT INTO visits (
                    patient_id, doctor_id, diagnosis, prescription_json, amount_paid,
                    symptoms, examination_notes, diagnosis_type, status,
                    started_at, updated_at, queue_entry_id, start_request_id,
                    start_operation, start_actor_id
                ) VALUES (?, ?, '', '[]', 0, '', '', '', 'in-progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, 'next', ?)
            `).run(queue.patient_id, actingUserId, queue.id, startRequestId, actingUserId);
            this.recordStartRequest(startRequestId, 'next', Number(result.lastInsertRowid), queue.patient_id, queue.id, actingUserId);
            this.logAudit('ENCOUNTER_START', 'visits', result.lastInsertRowid, actingUserId, `Started next encounter for queue entry ${queue.id}`);
            return this.getEncounterById(Number(result.lastInsertRowid));
        });
        return beginNext.immediate();
    }

    private updateEncounterClinicalData(encounterId: number, visit: any) {
        if (!visit) return;
        const data = {
            id: encounterId,
            diagnosis: visit.diagnosis ?? '',
            prescription_json: JSON.stringify(visit.prescription || []),
            amount_paid: Number(visit.amount_paid || 0),
            symptoms: visit.symptoms ?? '',
            examination_notes: visit.examination_notes ?? '',
            diagnosis_type: visit.diagnosis_type ?? ''
        };
        this.db.prepare(`
            UPDATE visits SET diagnosis = @diagnosis, prescription_json = @prescription_json,
                amount_paid = @amount_paid, symptoms = @symptoms,
                examination_notes = @examination_notes, diagnosis_type = @diagnosis_type,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id AND status = 'in-progress'
        `).run(data);
    }

    private validateStartRetry(encounter: any, expected: {
        operation: 'begin' | 'next'; actingUserId: number; patientId?: number; queueEntryId?: number;
    }) {
        if (encounter.request_operation !== expected.operation || encounter.request_actor_id !== expected.actingUserId) {
            throw new Error('Start request key was already used by another operation or actor');
        }
        this.assertResponsiblePractitioner(encounter, expected.actingUserId);
        if (expected.patientId != null && encounter.request_patient_id !== expected.patientId) {
            throw new Error('Start request key belongs to another patient');
        }
        if (expected.queueEntryId != null && encounter.request_queue_entry_id !== expected.queueEntryId) {
            throw new Error('Start request key belongs to another queue entry');
        }
        const queue = this.db.prepare('SELECT * FROM patient_queue WHERE id = ?').get(encounter.queue_entry_id);
        if (encounter.status !== 'in-progress' || !queue || queue.patient_id !== encounter.patient_id || queue.status !== 'in-consult') {
            throw new Error('Start request key is stale');
        }
        return this.hydrateVisit(encounter);
    }

    private assertResponsiblePractitioner(encounter: any, actingUserId: number) {
        if (Number(encounter.doctor_id) !== Number(actingUserId)) {
            throw new Error('Only the responsible practitioner can access this encounter');
        }
    }

    private getExactEncounterQueue(encounter: any, allowedStatuses: string[], errorMessage: string) {
        const queue = encounter.queue_entry_id
            ? this.db.prepare('SELECT * FROM patient_queue WHERE id = ?').get(encounter.queue_entry_id)
            : null;
        if (!queue || queue.patient_id !== encounter.patient_id || !allowedStatuses.includes(queue.status)) {
            throw new Error(errorMessage);
        }
        return queue;
    }

    private getStartRequest(requestId: string) {
        return this.db.prepare(`
            SELECT r.operation AS request_operation, r.actor_id AS request_actor_id,
                   r.patient_id AS request_patient_id, r.queue_entry_id AS request_queue_entry_id,
                   v.*
            FROM encounter_requests r
            JOIN visits v ON v.id = r.encounter_id
            WHERE r.request_id = ?
        `).get(requestId);
    }

    private recordStartRequest(requestId: string, operation: 'begin' | 'next', encounterId: number,
        patientId: number, queueEntryId: number, actingUserId: number) {
        this.db.prepare(`
            INSERT INTO encounter_requests (
                request_id, operation, encounter_id, patient_id, queue_entry_id, actor_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(requestId, operation, encounterId, patientId, queueEntryId, actingUserId);
    }

    private getEncounterById(id: number) {
        const row = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(id);
        if (!row) throw new Error('Encounter not found');
        return this.hydrateVisit(row);
    }

    private hydrateVisit(row: any) {
        return {
            ...row,
            prescription: row.prescription_json ? JSON.parse(row.prescription_json) : []
        };
    }



    // Vitals
    saveVitals(vitals: any) {
        if (vitals.id) {
            return this.db.prepare(`
                UPDATE vitals SET
                height = @height,
                weight = @weight,
                bmi = @bmi,
                temperature = @temperature,
                systolic_bp = @systolic_bp,
                diastolic_bp = @diastolic_bp,
                pulse = @pulse,
                respiratory_rate = @respiratory_rate,
                spo2 = @spo2
                WHERE id = @id
            `).run(vitals);
        } else {
            return this.db.prepare(`
                INSERT INTO vitals(
                    visit_id, patient_id, height, weight, bmi, 
                    temperature, systolic_bp, diastolic_bp, pulse, respiratory_rate, spo2
                )
                VALUES(
                    @visit_id, @patient_id, @height, @weight, @bmi, 
                    @temperature, @systolic_bp, @diastolic_bp, @pulse, @respiratory_rate, @spo2
                )
            `).run(vitals);
        }
    }

    getVitals(patientId: number) {
        // Get latest vitals for patient
        return this.db.prepare(`
            SELECT * FROM vitals WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1
        `).get(patientId);
    }


    // Queue Management
    getQueue() {
        return this.db.prepare(`
            SELECT q.id, q.patient_id, q.status, q.priority, q.check_in_time,
                   p.name as patient_name, p.gender, p.age, p.mobile,
                   active.id as active_encounter_id
            FROM patient_queue q
            JOIN patients p ON q.patient_id = p.id
            LEFT JOIN visits active ON active.queue_entry_id = q.id AND active.status = 'in-progress'
            WHERE q.status != 'completed'
            ORDER BY q.priority DESC, q.check_in_time ASC
        `).all();
    }

    addToQueue(patientId: number, priority: number = 1, actingUserId: number) {
        // Check if already in queue
        const existing = this.db.prepare('SELECT id FROM patient_queue WHERE patient_id = ? AND status != ?').get(patientId, 'completed');
        if (existing) throw new Error('Patient already in queue');

        const result = this.db.prepare('INSERT INTO patient_queue (patient_id, priority) VALUES (?, ?)').run(patientId, priority);
        this.logAudit('INSERT', 'patient_queue', result.lastInsertRowid, actingUserId, `Added patient ${patientId} to queue`);
        return result;
    }

    updateQueueStatus(id: number, status: string, actingUserId: number) {
        if (status === 'in-consult' || status === 'completed') {
            throw new Error('Consultation queue transitions require an encounter command');
        }
        const result = this.db.prepare('UPDATE patient_queue SET status = ? WHERE id = ?').run(status, id);
        this.logAudit('UPDATE', 'patient_queue', id, actingUserId, `Updated status to ${status} `);
        return result;
    }

    updateQueueStatusByPatientId(patientId: number, status: string, actingUserId: number) {
        if (status === 'in-consult' || status === 'completed') {
            throw new Error('Consultation queue transitions require an encounter command');
        }
        // Update the most recent non-completed queue entry for this patient
        // Fetch ID first for audit
        const existing = this.db.prepare(`SELECT id FROM patient_queue WHERE patient_id = ? AND status != 'completed' ORDER BY check_in_time DESC LIMIT 1`).get(patientId);

        if (!existing) return { changes: 0 };

        const result = this.db.prepare(`
            UPDATE patient_queue 
            SET status = ? 
            WHERE id = ?
        `).run(status, existing.id);

        if (result.changes > 0) {
            this.logAudit('UPDATE', 'patient_queue', existing.id, actingUserId, `Updated status to ${status} for patient ${patientId}`);
        }
        return result;
    }

    removeFromQueue(id: number, actingUserId: number) {
        const active = this.db.prepare("SELECT id FROM visits WHERE queue_entry_id = ? AND status = 'in-progress'").get(id);
        if (active) throw new Error('Cannot remove a queue entry with an active encounter');
        const result = this.db.prepare('DELETE FROM patient_queue WHERE id = ?').run(id);
        this.logAudit('DELETE', 'patient_queue', id, actingUserId, 'Removed from queue');
        return result;
    }

    // Audit Logging
    logAudit(action: string, tableName: string, recordId: number | bigint, userId: number, details: string) {
        try {
            this.db.prepare(`
                INSERT INTO audit_logs(action, table_name, record_id, user_id, details)
        VALUES(@action, @tableName, @recordId, @userId, @details)
            `).run({ action, tableName, recordId: Number(recordId), userId, details });
        } catch (e) {
            console.error('Failed to log audit:', e);
        }
    }

    getAuditLogs(limit: number = 100) {
        return this.db.prepare(`
            SELECT al.*, u.name as actor_name 
            FROM audit_logs al 
            LEFT JOIN users u ON al.user_id = u.id 
            ORDER BY al.timestamp DESC LIMIT ?
        `).all(limit);
    }

    // Appointment Requests
    getAppointmentRequests() {
        const reqs = this.db.prepare("SELECT * FROM appointment_requests ORDER BY created_at DESC").all();
        // Removed debug logs to prevent leak
        return reqs;
    }

    saveAppointmentRequest(req: any) {
        return this.db.prepare(`
            INSERT OR IGNORE INTO appointment_requests (id, patient_name, phone, date, time, reason)
            VALUES (@id, @patient_name, @phone, @date, @time, @reason)
        `).run(req);
    }

    updateAppointmentRequestStatus(id: string, status: string) {
        return this.db.prepare('UPDATE appointment_requests SET status = ? WHERE id = ?').run(status, id);
    }

    // Appointments (Bookings)
    getAppointments(date: string) {
        if (!this.db) throw new Error('DB not initialized');
        // Join with patients to get name
        return this.db.prepare(`
            SELECT a.*, p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender, p.address
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.date = ?
            ORDER BY a.time ASC
        `).all(date);
    }

    saveAppointment(appt: any) {
        if (!this.db) throw new Error('DB not initialized');
        if (appt.id) {
            return this.db.prepare(`
                UPDATE appointments SET status = ? WHERE id = ?
            `).run(appt.status, appt.id);
        } else {
            return this.db.prepare(`
                INSERT INTO appointments (patient_id, date, time, reason, status)
                VALUES (?, ?, ?, ?, 'CONFIRMED')
            `).run(appt.patient_id, appt.date, appt.time, appt.reason);
        }
    }

    logStats() {
        if (!this.db) return;
        try {
            const users = this.db.prepare('SELECT count(*) as c FROM users').get().c;
            const patients = this.db.prepare('SELECT count(*) as c FROM patients').get().c;
            const visits = this.db.prepare('SELECT count(*) as c FROM visits').get().c;
            const queue = this.db.prepare('SELECT count(*) as c FROM patient_queue').get().c;
            console.log('--- [DB STATS] ---');
            console.log(`Users: ${users}`);
            console.log(`Patients: ${patients}`);
            console.log(`Visits: ${visits}`);
            console.log(`Queue: ${queue}`);
            console.log('------------------');
        } catch (e) {
            console.error('Failed to log stats:', e);
        }
    }
}

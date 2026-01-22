
export class DatabaseService {
    private db: any;

    setDb(db: any) {
        this.db = db;
    }

    migrate() {
        if (!this.db) throw new Error('DB not initialized');

        // Settings Table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS settings (
            clinic_name TEXT,
            doctor_name TEXT,
            logo_path TEXT,
            license_key TEXT,
            drive_tokens TEXT
          );
        `);

        // Ensure columns exist (Non-destructive migration)
        try {
            this.db.exec(`ALTER TABLE settings ADD COLUMN drive_tokens TEXT`);
        } catch (e) { } // Column likely exists
        try {
            this.db.exec(`ALTER TABLE settings ADD COLUMN clinic_name TEXT`);
        } catch (e) { }
        try {
            this.db.exec(`ALTER TABLE settings ADD COLUMN doctor_name TEXT`);
        } catch (e) { }

        // Doctors Table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            specialty TEXT,
            license_number TEXT,
            active INTEGER DEFAULT 1
          );
        `);

        this.db.exec(`
          CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            name TEXT,
            mobile TEXT,
            age INTEGER,
            gender TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        this.db.exec(`
          CREATE TABLE IF NOT EXISTS visits(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            doctor_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            diagnosis TEXT,
            prescription_json TEXT,
            amount_paid REAL,
            FOREIGN KEY(patient_id) REFERENCES patients(id),
            FOREIGN KEY(doctor_id) REFERENCES doctors(id)
        );
        `);

        // Audit Logs Table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS audit_logs(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            table_name TEXT,
            record_id INTEGER,
            user_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `);

        // Patient Queue Table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS patient_queue(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            status TEXT DEFAULT 'waiting', --waiting, in -consult, completed
            priority INTEGER DEFAULT 1, --1: Normal, 2: Emergency
            check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(id) on DELETE CASCADE
        );
        `);

        // Migration: Add doctor_id if missing
        try {
            this.db.exec(`ALTER TABLE visits ADD COLUMN doctor_id INTEGER`);
        } catch (e) { }

        // Users Table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            name TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Seed Default Admin if not exists
        const admin = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!admin) {
            // Default password 'admin' - hashed (Argon2 hash for 'admin')
            // We will handle the hashing in the method, but for seed we insert a known hash or handle it dynamically
            // For now, let's insert a placeholder and we can update it or assume the saveUser handles it.
            // Actually, simplest is to use the saveUser logic, but we can't call it easily inside migrate if it depends on async argon2.
            // So we will insert a pre-calculated hash for 'admin' or just 'admin' and rely on auth service to handle migration or just set it insecurely first?
            // Better: Let's NOT seed syncronously if argon2 is async.
            // Strategy: We will add a 'seedAdmin' method that is called after init.
        }

        console.log('Database migration completed.');
    }

    async ensureAdminUser(password: string) {
        const hash = await import('argon2').then(a => a.hash(password));
        const admin = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!admin) {
            this.db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'Administrator');
            console.log('Default admin user created.');
        } else {
            // Update admin password to match current DB key - ensures they are always in sync
            this.db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, 'admin');
            console.log('Admin password synced with DB key.');
        }
    }

    // ... existing Settings methods ...

    // Users
    getUsers() {
        return this.db.prepare('SELECT id, username, role, name, active, created_at FROM users ORDER BY created_at DESC').all();
    }

    getUserByUsername(username: string) {
        return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    async validateUser(username: string, passwordTry: string) {
        const user = this.getUserByUsername(username);
        if (!user) { console.log('[DB] User not found:', username); return null; }
        if (user.active !== 1) { console.log('[DB] User inactive:', username, user.active); return null; }

        console.log(`[DB] Validating ${username}. Stored Hash len: ${user.password?.length}, Input PW len: ${passwordTry?.length}`);

        const argon2 = await import('argon2');
        try {
            if (await argon2.verify(user.password, passwordTry)) {
                return { id: user.id, username: user.username, role: user.role, name: user.name };
            } else {
                console.log('[DB] Password verification failed');
            }
        } catch (e) {
            console.error('Password verify failed', e);
        }
        return null;
    }

    async saveUser(user: any) {
        const argon2 = await import('argon2');
        if (user.id) {
            // Update
            let query = `UPDATE users SET role = @role, name = @name, active = @active WHERE id = @id`;
            if (user.password) {
                user.password = await argon2.hash(user.password);
                query = `UPDATE users SET role = @role, name = @name, active = @active, password = @password WHERE id = @id`;
            }
            return this.db.prepare(query).run(user);
        } else {
            // Insert
            if (!user.password) throw new Error('Password required for new user');

            console.log(`[DB] Creating user ${user.username}. Password len: ${user.password.length}`);
            user.password = await argon2.hash(user.password);
            console.log(`[DB] Generated Hash len: ${user.password.length} starts: ${user.password.substring(0, 10)}...`);

            user.active = user.active !== undefined ? user.active : 1; // Default to active
            return this.db.prepare(`
                INSERT INTO users(username, password, role, name, active)
                VALUES(@username, @password, @role, @name, @active)
            `).run(user);
        }
    }

    deleteUser(id: number) {
        return this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }

    // ... existing methods ...
    getSettings() {
        return this.db.prepare('SELECT * FROM settings LIMIT 1').get();
    }

    saveSettings(settings: any) {
        const existing = this.getSettings();
        if (existing) {
            // Build dynamic update query to allow partial updates
            const keys = Object.keys(settings);
            if (keys.length === 0) return;
            const setClause = keys.map(k => `${k} = @${k} `).join(', ');
            this.db.prepare(`UPDATE settings SET ${setClause} `).run(settings);
        } else {
            // First insert
            const keys = Object.keys(settings);
            const placeholders = keys.map(k => `@${k} `).join(', ');
            const cols = keys.join(', ');
            this.db.prepare(`INSERT INTO settings(${cols}) VALUES(${placeholders})`).run(settings);
        }
    }

    getDashboardStats() {
        const totalPatients = this.db.prepare('SELECT count(*) as count FROM patients').get().count;
        // Today's visits: date >= start of day
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = this.db.prepare('SELECT count(*) as count FROM visits WHERE date(date) = ?').get(today).count;
        return { totalPatients, todayVisits };
    }

    // Doctors
    getDoctors() {
        return this.db.prepare('SELECT * FROM doctors WHERE active = 1').all();
    }

    saveDoctor(doctor: any) {
        if (doctor.id) {
            return this.db.prepare(`
                UPDATE doctors SET
        name = @name,
            specialty = @specialty,
            license_number = @license_number 
                WHERE id = @id
            `).run(doctor);
        } else {
            return this.db.prepare(`
                INSERT INTO doctors(name, specialty, license_number)
        VALUES(@name, @specialty, @license_number)
            `).run(doctor);
        }
    }

    deleteDoctor(id: number) {
        // Soft delete
        return this.db.prepare('UPDATE doctors SET active = 0 WHERE id = ?').run(id);
    }

    // Patients
    getPatients(query: string = '') {
        if (!query) {
            return this.db.prepare('SELECT * FROM patients ORDER BY created_at DESC LIMIT 50').all();
        }
        const search = `% ${query}% `;
        return this.db.prepare(`
        SELECT * FROM patients 
      WHERE name LIKE ? OR mobile LIKE ?
            ORDER BY created_at DESC
                `).all(search, search);
    }

    getPatientById(id: number) {
        return this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    }

    savePatient(patient: any) {
        if (patient.id) {
            return this.db.prepare(`
        UPDATE patients SET
        name = @name,
            mobile = @mobile,
            age = @age,
            gender = @gender,
            address = @address
        WHERE id = @id
            `).run(patient);
        } else {
            if (!patient.uuid) {
                patient.uuid = crypto.randomUUID();
            }
            return this.db.prepare(`
        INSERT INTO patients(uuid, name, mobile, age, gender, address)
        VALUES(@uuid, @name, @mobile, @age, @gender, @address)
            `).run(patient);
        }
    }

    // Delete Patient (and their visits)
    deletePatient(id: number) {
        // Transaction manually
        this.db.prepare('DELETE FROM visits WHERE patient_id = ?').run(id);
        return this.db.prepare('DELETE FROM patients WHERE id = ?').run(id);
    }

    // Visits
    getVisits(patientId: number) {
        const visits = this.db.prepare(`
            SELECT v.*, d.name as doctor_name 
            FROM visits v 
            LEFT JOIN doctors d ON v.doctor_id = d.id 
            WHERE v.patient_id = ?
            ORDER BY v.date DESC
        `).all(patientId);
        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : []
        }));
    }

    getAllVisits(limit: number = 50) {
        const visits = this.db.prepare(`
            SELECT v.*, p.name as patient_name, d.name as doctor_name 
            FROM visits v 
            JOIN patients p ON v.patient_id = p.id
            LEFT JOIN doctors d ON v.doctor_id = d.id 
            ORDER BY v.date DESC
            LIMIT ?
        `).all(limit);
        return visits.map((v: any) => ({
            ...v,
            prescription: v.prescription_json ? JSON.parse(v.prescription_json) : []
        }));
    }

    deleteVisit(id: number) {
        return this.db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    }

    saveVisit(visit: any) {
        const data = {
            ...visit,
            prescription_json: JSON.stringify(visit.prescription || [])
        };

        const result = (() => {
            if (visit.id) {
                return this.db.prepare(`
            UPDATE visits SET
        diagnosis = @diagnosis,
            prescription_json = @prescription_json,
            amount_paid = @amount_paid,
            doctor_id = @doctor_id
            WHERE id = @id
            `).run(data);
            } else {
                return this.db.prepare(`
            INSERT INTO visits(patient_id, doctor_id, diagnosis, prescription_json, amount_paid)
        VALUES(@patient_id, @doctor_id, @diagnosis, @prescription_json, @amount_paid)
            `).run(data);
            }
        })();

        return result;
    }


    // Queue Management
    getQueue() {
        return this.db.prepare(`
            SELECT q.*, p.name as patient_name, p.gender, p.age, p.mobile 
            FROM patient_queue q
            JOIN patients p ON q.patient_id = p.id
            WHERE q.status != 'completed'
            ORDER BY q.priority DESC, q.check_in_time ASC
        `).all();
    }

    addToQueue(patientId: number, priority: number = 1) {
        // Check if already in queue
        const existing = this.db.prepare('SELECT id FROM patient_queue WHERE patient_id = ? AND status != ?').get(patientId, 'completed');
        if (existing) throw new Error('Patient already in queue');

        const result = this.db.prepare('INSERT INTO patient_queue (patient_id, priority) VALUES (?, ?)').run(patientId, priority);
        this.logAudit('INSERT', 'patient_queue', result.lastInsertRowid, 1, `Added patient ${patientId} to queue`);
        return result;
    }

    updateQueueStatus(id: number, status: string) {
        const result = this.db.prepare('UPDATE patient_queue SET status = ? WHERE id = ?').run(status, id);
        this.logAudit('UPDATE', 'patient_queue', id, 1, `Updated status to ${status} `);
        return result;
    }

    updateQueueStatusByPatientId(patientId: number, status: string) {
        // Update the most recent non-completed queue entry for this patient
        const result = this.db.prepare(`
            UPDATE patient_queue 
            SET status = ? 
            WHERE patient_id = ? AND status != 'completed'
        `).run(status, patientId);

        if (result.changes > 0) {
            this.logAudit('UPDATE', 'patient_queue', patientId, 1, `Updated status to ${status} for patient ${patientId}`);
        }
        return result;
    }

    removeFromQueue(id: number) {
        const result = this.db.prepare('DELETE FROM patient_queue WHERE id = ?').run(id);
        this.logAudit('DELETE', 'patient_queue', id, 1, 'Removed from queue');
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
        return this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
    }
}

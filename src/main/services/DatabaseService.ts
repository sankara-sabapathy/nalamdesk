
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
          CREATE TABLE IF NOT EXISTS visits (
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

        // Migration: Add doctor_id if missing
        try {
            this.db.exec(`ALTER TABLE visits ADD COLUMN doctor_id INTEGER`);
        } catch (e) { }

        console.log('Database migration completed.');
    }

    // Settings
    getSettings() {
        return this.db.prepare('SELECT * FROM settings LIMIT 1').get();
    }

    saveSettings(settings: any) {
        const existing = this.getSettings();
        if (existing) {
            // Build dynamic update query to allow partial updates
            const keys = Object.keys(settings);
            if (keys.length === 0) return;
            const setClause = keys.map(k => `${k} = @${k}`).join(', ');
            this.db.prepare(`UPDATE settings SET ${setClause}`).run(settings);
        } else {
            // First insert
            const keys = Object.keys(settings);
            const placeholders = keys.map(k => `@${k}`).join(', ');
            const cols = keys.join(', ');
            this.db.prepare(`INSERT INTO settings (${cols}) VALUES (${placeholders})`).run(settings);
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
                INSERT INTO doctors (name, specialty, license_number) 
                VALUES (@name, @specialty, @license_number)
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
        const search = `%${query}%`;
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
        INSERT INTO patients (uuid, name, mobile, age, gender, address)
        VALUES (@uuid, @name, @mobile, @age, @gender, @address)
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

    deleteVisit(id: number) {
        return this.db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    }

    saveVisit(visit: any) {
        const data = {
            ...visit,
            prescription_json: JSON.stringify(visit.prescription || [])
        };

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
            INSERT INTO visits (patient_id, doctor_id, diagnosis, prescription_json, amount_paid)
            VALUES (@patient_id, @doctor_id, @diagnosis, @prescription_json, @amount_paid)
        `).run(data);
        }
    }
}

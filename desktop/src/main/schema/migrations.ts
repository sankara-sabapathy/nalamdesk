export const MIGRATIONS = [
    {
        version: 1,
        up: (db: any) => {
            console.log('Running Migration v1 (Baseline)...');

            // 1. Settings Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    clinic_name TEXT,
                    doctor_name TEXT,
                    logo_path TEXT,
                    license_key TEXT,
                    drive_tokens TEXT,
                    cloud_clinic_id TEXT,
                    cloud_api_key TEXT,
                    cloud_enabled INTEGER DEFAULT 0
                );
            `);

            // Ensure columns exist (for existing dev DBs that might be partial)
            const settingsCols = ['drive_tokens TEXT', 'clinic_name TEXT', 'doctor_name TEXT', 'cloud_clinic_id TEXT', 'cloud_api_key TEXT', 'cloud_enabled INTEGER DEFAULT 0'];
            settingsCols.forEach(col => {
                try { db.exec(`ALTER TABLE settings ADD COLUMN ${col}`); } catch (e) { }
            });

            // 2. Users Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    role TEXT,
                    name TEXT,
                    specialty TEXT,
                    license_number TEXT,
                    active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            // Users columns
            const userCols = ['specialty TEXT', 'license_number TEXT'];
            userCols.forEach(col => {
                try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch (e) { }
            });


            // 3. Patients Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT UNIQUE,
                    name TEXT,
                    mobile TEXT,
                    age INTEGER,
                    gender TEXT,
                    address TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    dob DATE,
                    blood_group TEXT,
                    email TEXT,
                    emergency_contact_name TEXT,
                    emergency_contact_mobile TEXT,
                    street TEXT,
                    city TEXT,
                    state TEXT,
                    zip_code TEXT,
                    insurance_provider TEXT,
                    policy_number TEXT
                );
            `);
            // Patient Add Columns (Legacy safety)
            const patientCols = [
                'dob DATE', 'blood_group TEXT', 'email TEXT',
                'emergency_contact_name TEXT', 'emergency_contact_mobile TEXT',
                'street TEXT', 'city TEXT', 'state TEXT', 'zip_code TEXT',
                'insurance_provider TEXT', 'policy_number TEXT'
            ];
            patientCols.forEach(col => {
                try { db.exec(`ALTER TABLE patients ADD COLUMN ${col}`); } catch (e) { }
            });


            // 4. Visits Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS visits(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER,
                    doctor_id INTEGER,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    diagnosis TEXT,
                    prescription_json TEXT,
                    amount_paid REAL,
                    symptoms TEXT,
                    examination_notes TEXT,
                    diagnosis_type TEXT,
                    FOREIGN KEY(patient_id) REFERENCES patients(id),
                    FOREIGN KEY(doctor_id) REFERENCES users(id)
                );
            `);
            // Visit Add Columns (Legacy safety)
            const visitCols = ['doctor_id INTEGER', 'symptoms TEXT', 'examination_notes TEXT', 'diagnosis_type TEXT'];
            visitCols.forEach(col => {
                try { db.exec(`ALTER TABLE visits ADD COLUMN ${col}`); } catch (e) { }
            });


            // 5. Vitals Table
            db.exec(`
                CREATE TABLE IF NOT EXISTS vitals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    visit_id INTEGER,
                    patient_id INTEGER,
                    height REAL,
                    weight REAL,
                    bmi REAL,
                    temperature REAL,
                    systolic_bp INTEGER,
                    diastolic_bp INTEGER,
                    pulse INTEGER,
                    respiratory_rate INTEGER,
                    spo2 INTEGER,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE,
                    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
                );
            `);

            // 6. Audit Logs
            db.exec(`
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

            // 7. Patient Queue
            db.exec(`
                CREATE TABLE IF NOT EXISTS patient_queue(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER,
                    status TEXT DEFAULT 'waiting', --waiting, in-consult, completed
                    priority INTEGER DEFAULT 1, --1: Normal, 2: Emergency
                    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(patient_id) REFERENCES patients(id) on DELETE CASCADE
                );
            `);

            // 8. Appointment Requests
            db.exec(`
                CREATE TABLE IF NOT EXISTS appointment_requests (
                    id TEXT PRIMARY KEY,
                    patient_name TEXT,
                    phone TEXT,
                    date TEXT,
                    time TEXT,
                    reason TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 9. Appointments
            db.exec(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER,
                    date TEXT,
                    time TEXT,
                    reason TEXT,
                    status TEXT DEFAULT 'CONFIRMED', -- CONFIRMED, CHECKED_IN, CANCELLED, COMPLETED
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(patient_id) REFERENCES patients(id)
                );
            `);

            // Seed Admin (Legacy check inside migration? No, better to do it in EnsureAdminUser logic outside, or here?)
            // Robust approach: Migrations handle Schema. Seeding relies on App Logic or a separate Seed Migration.
            // We left 'ensureAdminUser' in DatabaseService, which is fine.
        }
    },
    {
        version: 2,
        up: (db: any) => {
            console.log('Running Migration v2 (RBAC Roles)...');
            db.exec(`
                CREATE TABLE IF NOT EXISTS roles (
                    name TEXT PRIMARY KEY,
                    permissions TEXT -- JSON array of strings
                );
            `);

            // Seed Default Roles
            const roles = [
                {
                    name: 'doctor',
                    permissions: JSON.stringify([
                        'getPatients', 'savePatient', 'getVisits', 'getAllVisits', 'saveVisit',
                        'getQueue', 'addToQueue', 'removeFromQueue', 'updateQueueStatus',
                        'getDashboardStats', 'getDoctors', 'getPublicSettings'
                    ])
                },
                {
                    name: 'receptionist',
                    permissions: JSON.stringify([
                        'getPatients', 'savePatient',
                        'getQueue', 'addToQueue', 'removeFromQueue', 'updateQueueStatus', 'updateQueueStatusByPatientId', 'getPublicSettings'
                    ])
                },
                {
                    name: 'nurse',
                    permissions: JSON.stringify([
                        'getPatients', 'getQueue', 'updateQueueStatus', 'getPublicSettings'
                    ])
                }
            ];

            const insert = db.prepare('INSERT OR IGNORE INTO roles (name, permissions) VALUES (@name, @permissions)');
            roles.forEach(role => insert.run(role));
        }
    },
    {
        version: 3,
        up: (db: any) => {
            console.log('Running Migration v3 (Staff Fields)...');
            const cols = [
                'mobile TEXT',
                'email TEXT',
                'designation TEXT',
                'joining_date TEXT',
                'address TEXT',
                'emergency_contact_name TEXT',
                'emergency_contact_phone TEXT',
                'password_reset_required INTEGER DEFAULT 0',
                'dob TEXT'
            ];
            cols.forEach(col => {
                try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch (e) { }
            });
        }
    },
    {
        version: 4,
        up: (db: any) => {
            console.log('Running Migration v4 (Drive & Backup Settings)...');
            const cols = [
                'drive_client_id TEXT',
                'drive_client_secret TEXT',
                'local_backup_path TEXT'
            ];
            cols.forEach(col => {
                try { db.exec(`ALTER TABLE settings ADD COLUMN ${col}`); } catch (e) { console.debug(`[Migration] Column ${col} might already exist.`); }
            });
        }
    },
    {
        version: 5,
        up: (db: any) => {
            console.log('Running Migration v5 (Backup Schedule)...');
            try { db.exec(`ALTER TABLE settings ADD COLUMN backup_schedule TEXT DEFAULT '13:00'`); } catch (e) { console.debug('[Migration] backup_schedule column might already exist.'); }
        }
    },
    {
        version: 6,
        up: (db: any) => {
            console.log('Running Migration v6 (Cloud Backup Schedule)...');
            try { db.exec(`ALTER TABLE settings ADD COLUMN cloud_backup_schedule TEXT DEFAULT '13:00'`); } catch (e) { console.debug('[Migration] cloud_backup_schedule column might already exist.'); }
        }
    },
    {
        version: 7,
        up: (db: any) => {
            console.log('Running Migration v7 (Encounter integrity)...');

            const visitCols = [
                "status TEXT DEFAULT 'finished'",
                'started_at DATETIME',
                'completed_at DATETIME',
                'updated_at DATETIME',
                'queue_entry_id INTEGER',
                'start_request_id TEXT',
                'start_operation TEXT',
                'start_actor_id INTEGER'
            ];
            visitCols.forEach(col => {
                try { db.exec(`ALTER TABLE visits ADD COLUMN ${col}`); } catch (e) { console.debug(`[Migration] visits.${col.split(' ')[0]} might already exist.`); }
            });

            // All records created by earlier versions were persisted as completed history.
            db.exec(`
                UPDATE visits
                SET status = CASE WHEN status = 'in-progress' THEN status ELSE 'finished' END,
                    started_at = COALESCE(started_at, date),
                    completed_at = CASE WHEN status = 'in-progress' THEN completed_at ELSE COALESCE(completed_at, date) END,
                    updated_at = COALESCE(updated_at, date)
                ;

                CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_queue_entry
                    ON visits(queue_entry_id) WHERE queue_entry_id IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_start_request
                    ON visits(start_request_id) WHERE start_request_id IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_one_active_patient
                    ON visits(patient_id) WHERE status = 'in-progress';
                CREATE INDEX IF NOT EXISTS idx_visits_status_updated
                    ON visits(status, updated_at);

                CREATE TABLE IF NOT EXISTS encounter_requests (
                    request_id TEXT PRIMARY KEY,
                    operation TEXT NOT NULL,
                    encounter_id INTEGER NOT NULL,
                    patient_id INTEGER NOT NULL,
                    queue_entry_id INTEGER NOT NULL,
                    actor_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(encounter_id) REFERENCES visits(id) ON DELETE CASCADE,
                    FOREIGN KEY(patient_id) REFERENCES patients(id),
                    FOREIGN KEY(queue_entry_id) REFERENCES patient_queue(id),
                    FOREIGN KEY(actor_id) REFERENCES users(id)
                );
                CREATE INDEX IF NOT EXISTS idx_encounter_requests_encounter
                    ON encounter_requests(encounter_id);

                CREATE TRIGGER IF NOT EXISTS trg_visits_queue_link_insert
                BEFORE INSERT ON visits WHEN NEW.queue_entry_id IS NOT NULL
                BEGIN
                    SELECT CASE WHEN NOT EXISTS (
                        SELECT 1 FROM patient_queue q
                        WHERE q.id = NEW.queue_entry_id AND q.patient_id = NEW.patient_id
                    ) THEN RAISE(ABORT, 'Encounter queue entry does not match patient') END;
                END;

                CREATE TRIGGER IF NOT EXISTS trg_visits_queue_link_update
                BEFORE UPDATE OF queue_entry_id, patient_id ON visits WHEN NEW.queue_entry_id IS NOT NULL
                BEGIN
                    SELECT CASE WHEN NOT EXISTS (
                        SELECT 1 FROM patient_queue q
                        WHERE q.id = NEW.queue_entry_id AND q.patient_id = NEW.patient_id
                    ) THEN RAISE(ABORT, 'Encounter queue entry does not match patient') END;
                END;

                CREATE TRIGGER IF NOT EXISTS trg_visits_status_insert
                BEFORE INSERT ON visits
                WHEN NEW.status IS NULL OR NEW.status NOT IN ('in-progress', 'finished')
                BEGIN SELECT RAISE(ABORT, 'Invalid encounter status'); END;

                CREATE TRIGGER IF NOT EXISTS trg_visits_status_update
                BEFORE UPDATE OF status ON visits
                WHEN NEW.status IS NULL OR NEW.status NOT IN ('in-progress', 'finished')
                BEGIN SELECT RAISE(ABORT, 'Invalid encounter status'); END;
            `);

            // Backfill any encounter created by a pre-release v7 build.
            db.exec(`
                INSERT OR IGNORE INTO encounter_requests (
                    request_id, operation, encounter_id, patient_id, queue_entry_id, actor_id
                )
                SELECT start_request_id, COALESCE(start_operation, 'begin'), id,
                       patient_id, queue_entry_id, COALESCE(start_actor_id, doctor_id)
                FROM visits
                WHERE start_request_id IS NOT NULL AND queue_entry_id IS NOT NULL
                  AND COALESCE(start_actor_id, doctor_id) IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM patient_queue q
                      WHERE q.id = visits.queue_entry_id AND q.patient_id = visits.patient_id
                  )
                  AND EXISTS (SELECT 1 FROM patients p WHERE p.id = visits.patient_id)
                  AND EXISTS (
                      SELECT 1 FROM users u
                      WHERE u.id = COALESCE(visits.start_actor_id, visits.doctor_id)
                  );
            `);

            // LAN/offline doctors use the same explicit encounter commands as Electron.
            const doctor = db.prepare('SELECT permissions FROM roles WHERE name = ?').get('doctor');
            if (doctor?.permissions) {
                const permissions = new Set<string>(JSON.parse(doctor.permissions));
                [
                    'beginConsultation', 'getActiveConsultation', 'saveConsultationProgress',
                    'completeConsultation', 'postponeConsultation', 'resumeConsultation',
                    'beginNextConsultation'
                ].forEach(permission => permissions.add(permission));
                db.prepare('UPDATE roles SET permissions = ? WHERE name = ?')
                    .run(JSON.stringify([...permissions]), 'doctor');
            }
        }
    },
    {
        version: 8,
        up: (db: any) => {
            console.log('Running Migration v8 (Credential Rotation Journal)...');
            db.exec(`
                CREATE TABLE IF NOT EXISTS credential_rotation_journal (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    username TEXT NOT NULL,
                    previous_hash TEXT NOT NULL,
                    replacement_hash TEXT NOT NULL,
                    previous_reset_required INTEGER NOT NULL DEFAULT 0,
                    phase TEXT NOT NULL CHECK (phase IN ('prepared', 'applied')),
                    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }
    }
];

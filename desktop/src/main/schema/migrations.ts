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
                try { db.exec(`ALTER TABLE settings ADD COLUMN ${col}`); } catch (e) { }
            });
        }
    }
];

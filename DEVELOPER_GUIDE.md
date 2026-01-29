# NalamDesk Developer Guide 👨‍💻

## 🏗️ Architecture Overview

NalamDesk uses a **Hybrid Architecture** combining a secure "Offline-First" Desktop App with a lightweight Cloud Interface for discovery and booking.

### 1. The Desktop App (The "Fortress")
*   **Tech Stack:**
    *   **Runtime:** [Electron](https://www.electronjs.org/)
    *   **Frontend:** [Angular v17+](https://angular.io/) (Standalone Components)
    *   **Database:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with [SQLCipher](https://github.com/m4heshd/better-sqlite3-multiple-ciphers)
    *   **Migrations:** robust, versioned system in `src/main/schema/migrations.ts`.
    *   **Encryption:** AES-256 (Data at Rest). Key derived via `argon2` from user password.
*   **Role:** The "Source of Truth". All patient medical data lives here. It never leaves the device decrypted.

### 2. Database Schema Migrations 🧱
 We use a custom **Versioned Transactional Migration** system to ensure data safety.
*   **Location:** `src/main/schema/migrations.ts`
*   **How to modify Schema:**
    1.  Increment the version number in the `MIGRATIONS` array.
    2.  Add a new migration object with an `up(db)` function.
    3.  **Strict Rule:** Always use `db.exec` or prepared statements within the `up` function.
*   **Safety:** 
    *   Migrations run in a single atomic transaction.
    *   `PRAGMA user_version` tracks state.
    *   **Auto-Backup:** The system creates `nalamdesk.db.bak` before every migration attempt.

### 3. The Cloud Intake (The "Mailbox")
*   **Tech Stack:**
    *   **Server:** Node.js (Fastify)
    *   **Database:** SQLite (WAL Mode) + Litestream (S3 Replication)
    *   **Deployment:** Docker Compose (Self-Hosted)
*   **Role:** A temporary holding area for *incoming* appointments. It does NOT store medical history.
*   **Flow:**
    1.  Patient POSTs to `/api/v1/book` (Cloud).
    2.  Cloud stores request in `appointments_queue`.
    3.  Desktop App polls `/api/v1/sync` every 30s.
    4.  Desktop downloads appointment -> Adds to Local DB -> Acks success.
    5.  Cloud deletes the appointment.

### 4. Security & Services Layer 🛡️
New enterprise features have been integrated into the Main process:
*   **Role-Based Access Control (RBAC):**
    *   **Permissions:** Stored in DB table `roles`. Seeded via Migration V2.
    *   **Enforcement:** `server.ts` uses `DatabaseService.getPermissions(role)` to validate IPC calls dynamically.
    *   **Public Data:** `getPublicSettings` endpoint allows safe access to branding without exposing secrets.
*   **Session Management:** `SessionService.ts` replaces global state, managing user identity in memory safely.
*   **Automated Backups:** `BackupService.ts` uses `cron` to securely upload the encrypted database to Google Drive (if authenticated) every night at 10 PM.
*   **Crash Reporting:** `CrashService.ts` catches `uncaughtException` and `render-process-gone`, sanitizes PII (e.g., file paths), and prompts the user to save a JSON report manually. Privacy-first, no auto-upload.

---

## 💻 Development Setup

### Prerequisites
*   Node.js v18+
*   Python (for compiling native modules)
*   C++ Build Tools (Visual Studio / Xcode)

### Quick Start
```bash
# 1. Clone
git clone https://github.com/yourusername/nalamdesk.git
cd nalamdesk

# 2. Install
npm install

# 3. Use Developer Mode (Rebuilds native deps for current OS)
npm run rebuild:electron

# 4. Start (Runs Angluar + Electron concurrently)
npm start
```

### Directory Structure
*   `src/main`: Electron Main Process (Node.js). Handles DB, File System, IPC.
*   `src/renderer`: Angular App (UI).
*   `web/`: Cloud Server Code (Fastify).
*   `scripts/`: Utility scripts.

---

## ☁️ Cloud Sync Implementation

### The Sync Protocol
We use a **Pull-Based** synchronization pattern to keep the desktop secure (no open inbound ports).

**Endpoints (Cloud):**
*   `POST /onboard`: Registers a new clinic. Returns `clinic_id` + `api_key`.
*   `POST /book`: Public endpoint for patients to book.
*   `GET /sync`: Private endpoint (Auth via API Key). Returns pending messages.
*   `POST /ack`: Private endpoint. Confirms receipt so Cloud can delete messages.

**Client Service (`CloudSyncService.ts`):**
*   Located in `src/main/services/CloudSyncService.ts`.
*   Polls every 30 seconds.
*   **CRITICAL:** When saving a synced patient, you MUST provide explicit `null` for all optional fields (e.g., `dob`, `email`) because `better-sqlite3` prepared statements expect all named parameters to be present.

### Self-Hosting the Cloud Node
If you want to run your own NalamDesk Cloud Server:

1.  **Navigate to Server Directory:**
    ```bash
    cd web/
    ```
2.  **Configuration:**
    *   Copy `.env.example` to `.env`.
    *   Set `APP_SECRET` (Must match Client).
3.  **Run with Docker:**
    ```bash
    docker-compose up -d
    ```
4.  **Security:**
    *   Use a Reverse Proxy (Caddy/Nginx) for HTTPS.
    *   Rate Limit `/book` endpoint.

---

## 🧪 Testing

*   **Unit Tests:** `npm run test` (Vitest)
*   **E2E Tests:** `npm run e2e` (Playwright)

## 📦 Building for Production

To create an installer (`.exe`, `.dmg`):

```bash
npm run pack
```
Artifacts will be in `dist/`.

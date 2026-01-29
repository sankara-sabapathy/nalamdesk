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
  *   **Server:** Node.js (Fastify) - Reuses core logic from `src/server/app.ts`.
  *   **Database:** SQLite (WAL Mode).
  *   **Deployment:** Docker on AWS Lightsail.
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
    *   **Enforcement:** `src/server/app.ts` (`ApiServer`) uses `DatabaseService.getPermissions(role)` to validate IPC calls dynamically.
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

# 4. Start (Runs Angular + Electron concurrently)
npm start
```

### Directory Structure
*   `src/main`: Electron Main Process (Node.js). Handles DB, File System, IPC.
*   `src/renderer`: Angular App (UI).
*   `src/server`: **NEW** Shared Server Core (Fastify). Runs in both Electron and Cloud.
*   `infrastructure/`: Terraform scripts for AWS Lightsail.
*   `.github/workflows`: CI/CD pipelines.
*   `web/`: (Legacy/Reference) Old cloud server code.
*   `scripts/`: Utility scripts.

---

## ☁️ Cloud Deployment & Infrastructure

### 1. Unified Architecture
We use a **Shared Core** approach. The `ApiServer` in `src/server/app.ts` is used by:
1.  **Electron App**: Runs locally on port 3000 (Internal) to serve the UI and handle IPC.
2.  **Cloud Server**: Runs in a Docker container on AWS Lightsail to handle public bookings.

### 2. AWS Lightsail Deployment
The cloud component is deployed to a **$3.50/mo AWS Lightsail Instance** (Ubuntu) running Docker.

#### Infrastructure as Code (Terraform)
Located in `infrastructure/main.tf`.
*   **Provisions**: Lightsail Instance, Static IP, Firewall Rules (Ports 22, 80, 443).
*   **State**: Stored in a private S3 bucket.

#### CI/CD Pipelines (GitHub Actions)
1.  **Provision Infrastructure** (`provision.yml`):
    *   **Trigger**: Manual (`workflow_dispatch`).
    *   **Action**: Checks/Creates S3 bucket -> Runs `terraform apply` -> Outputs IP.
2.  **Deploy to Lightsail** (`deploy.yml`):
    *   **Trigger**: Manual (`workflow_dispatch`).
    *   **Action**: Builds Docker Image -> Pushes to GHCR -> SSH into server -> Pulls & Restarts Container.

### 3. How to Deploy (Manual)
1.  **Provision**: Run "Provision Infrastructure" workflow once.
2.  **Configure Secrets**: Update `LIGHTSAIL_IP` in GitHub Secrets.
3.  **Deploy**: Run "Deploy to Lightsail" workflow. Select branch (main/feature).

### 4. Local Server Development
To run the server component without Electron (for testing cloud API):
```bash
npm run build:server
npm run start:server
# Server runs at http://localhost:3000
```

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

# NalamDesk Project Rules & Context 🧠

## 1. Architecture Overview (Hybrid)
NalamDesk is a **Hybrid Medical Practice Management System** that combines privacy-first local data with cloud-enabled remote access.

### 🏢 Desktop App (Hyperlocal)
- **Framework**: Electron + Angular 17.
- **Location**: `desktop/`
- **Database**: SQLite (`nalamdesk.db`) stored locally.
- **Logic**: 
  - Main Process (`src/main`): Handles OS integration, SQLite DB access, Google Drive Backups, and Cloud Sync.
  - Renderer (`src/renderer`): Angular UI.
  - Local Server (`src/server`): Embedded Fastify server for local device access (optional).

### ☁️ Cloud Platform
- **Location**: `cloud/`
- **Host**: AWS Lightsail (`ap-south-1`) + S3 + CloudFront.
- **Logic**:
  - `cloud/api`: Stateless Fastify API for syncing data between doctor's desktop and remote devices.
  - `cloud/web`: Angular Web App hosted on S3 + CloudFront for patients/remote doctors.
- **Infrastructure**:
  - **Computing**: Lightsail Instance (Dockerized API).
  - **Storage**: 
    - `nalamdesk-web-*`: Private S3 for Frontend.
    - `nalamdesk-docs-*`: Private S3 for Documentation.
    - `nalamdesk-backups-*`: Private S3 for Encrypted DB Backups (Lifecycle: 30 days).
  - **CDN**: CloudFront (Termination for HTTPS, caching).

## 2. Directory Structure
```
/
├── desktop/                # The Electron Application
│   ├── src/
│   │   ├── main/           # Electron Main Process (DB, Sync, Drive)
│   │   ├── renderer/       # Angular UI
│   │   └── server/         # Embedded Local Server
│   ├── package.json        # "nalamdesk-desktop"
│   └── angular.json        # Angular Build Config
├── cloud/                  # The Remote Platform
│   ├── api/                # Node.js/Fastify Backend (Stateless)
│   ├── web/                # Cloud Web App
│   ├── infrastructure/     # Terraform (main.tf)
│   └── documentation/      # Project Docs (MkDocs/Docusaurus)
└── .agent/                 # Agent Rules & Context
```

## 3. Critical Rules ⚠️
1.  **Process Hygiene**: Always KILL `node`, `git`, `npm` processes before performing directory operations on Windows to avoid file locks.
2.  **Stateless Cloud**: The Cloud API (`cloud/api`) MUST NOT rely on local file storage. It uses ephemeral containers. State is in SQLite (Desktop) or Sync Payload.
3.  **Database Path**: 
    - Prod: `app.getPath('userData')/nalamdesk.db`
    - Dev: `desktop/nalamdesk.db` (Relative path: `../../nalamdesk.db` from dist).
4.  **Secrets**: NEVER commit `.env` or `credentials.json`.
5.  **Sync Logic**: If Cloud returns `401` or `404` (Clinic Not Found), the Desktop App MUST self-heal (reset cloud settings) to prevent orphaned states.

## 4. Commands
- **Start Desktop**: `cd desktop && npm start`
- **Build Desktop**: `cd desktop && npm run dist:win`
- **Deploy Cloud**: `cd cloud/infrastructure && terraform apply`

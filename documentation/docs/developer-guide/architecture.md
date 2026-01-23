---
sidebar_position: 1
---

# Architecture Overview

NalamDesk uses a secure, local-first hybrid desktop architecture designed for resilience and performance.

## Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | Electron | Cross-platform desktop environment. |
| **Frontend** | Angular + TailwindCSS | Responsive, component-based UI. |
| **Backend** | Fastify | High-performance local Node.js server. |
| **Database** | SQLite + SQLCipher | Encrypted local data storage. |
| **Security** | Argon2 | Industry-standard password hashing. |

## System Components

### 1. Main Process (Electron)
- **Entry Point**: `src/main/main.ts`
- **Responsibilities**:
    - App Window Management.
    - Native System Integrations (File System, Dialogs).
    - Auto-updates (electron-updater).
    - Spawning the background component calls.

### 2. Local API Server (Fastify)
- **Entry Point**: `src/main/server.ts`
- **Port**: `3000` (Localhost)
- **Role**: Validates requests and proxies them to the `DatabaseService`.
- **Security**:
    - **JWT Authentication**: Validates tokens on protected routes.
    - **IP Restriction**: Admin login is restricted to local IP (`127.0.0.1` or `::1`) to prevent network-based attacks.

### 3. Database Layer
- **Service**: `src/main/services/DatabaseService.ts`
- **Engine**: `better-sqlite3-multiple-ciphers`
- **Encryption**: The entire database file (`nalamdesk.db`) is encrypted on disk. The encryption key is derived securely, ensuring that data is inaccessible without proper authentication.

## Data Flow Diagram

```mermaid
graph TD
    User[User] -->|Interact| UI[Angular Frontend]
    UI -->|HTTP POST (JWT)| Server[Fastify Server (Port 3000)]
    Server -->|Validate Token & RBAC| Auth[Auth Middleware]
    Auth -->|Approved| DBService[Database Service]
    DBService -->|SQL Query| SQLite[(Encrypted SQLite DB)]
    SQLite -->|Result| DBService
    DBService -->|JSON Response| UI
```

## Security Architecture

### Password Hashing
NalamDesk uses **Argon2**, a memory-hard password hashing algorithm, to store user passwords. This makes brute-force attacks computationally expensive and infeasible.

- **Implementation**: `src/main/services/DatabaseService.ts` -> `saveUser` / `validateUser`.

### Role-Based Access Control (RBAC)
Access control is enforced at the API level in `server.ts`.

| Role | Permissions |
| :--- | :--- |
| **Admin** | **Full Access**. User management, Clinic Settings, Backup/Restore. |
| **Doctor** | Patient Records, Prescriptions, Queue Management. |
| **Receptionist** | Patient Registration, Queue Management. |
| **Nurse** | Patient Vitals (Future), Queue Monitoring. |

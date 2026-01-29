# Data Synchronization Research & Recommendation

## Executive Summary
For the NalamDesk local-first clinic application, we evaluated industry-leading solutions for syncing data across devices.

**Update:** We have added a "Local Server" option based on the user's suggestion, which offers significant simplification at the cost of offline capabilities for the secondary device.

**Recommendation:**
1.  **For Maximum Simplicity (Recommended for MVP):** **Local Server Model**. One machine (Doctor's) hosts the app; others connect via browser. Zero sync complexity.
2.  **For Robustness/Offline:** **RxDB**. If network reliability is a concern or both devices must work independently.

---

## Options Comparison

### 4. Local Server (User Suggestion) - HOSTED ARCHITECTURE
Instead of syncing data between two independent databases, one computer acts as the dedicated server.

*   **How it works**:
    *   **Doctor's PC**: Runs the Electron App *and* a web server (e.g., Express/Fastify) on a specific port (e.g., 3000).
    *   **Front Desk**: Opens `http://192.168.1.X:3000` in their web browser (Chrome/Edge).
*   **Pros**:
    *   **Zero Sync Logic**: There is only one single source of truth (one database). No merge conflicts are possible.
    *   **Speed**: Implementation is significantly faster/cheaper (~90% less code) than building a robust sync engine.
    *   **Maintenance**: Backup and updates only need to happen on one machine.
*   **Cons**:
    *   **Single Point of Failure**: If the Doctor's PC is turned off or crashes, the Front Desk cannot work.
    *   **Network Dependency**: If the Wi-Fi drops, the Front Desk cannot access the patient list. (The Doctor can still work fine).
*   **Verdict**: **Strongly Recommended** if you can guarantee the Doctor's PC is always on during clinic hours and the Wi-Fi is relatively stable.

### 1. RxDB (Reactive Database)
RxDB is a NoSQL-layer that sits on top of various databases for "Offline First" apps.
*   **How it works**: Both devices have their own local database and sync changes to each other.
*   **Pros**: Works offline. If internet/Wi-Fi dies, Front Desk can still queue patients (data syncs when connection returns).
*   **Cons**: Complexity. Requires handling conflict policies and ensuring data consistency.

### 2. PowerSync
PowerSync is a sync engine specifically for SQLite.
*   **Pros**: Keep writing SQL. High performance.
*   **Cons**: Requires distinct backend.

### 3. ElectricSQL
Active-active replication for SQLite.
*   **Pros**: Cutting edge.
*   **Cons**: Postgres dependency.

---

## Technical Implementation for "Local Server"

If you choose the **Local Server** approach, the implementation changes:

1.  **Backend**: Your Electron app's Main process must start a minimal HTTP server.
    ```javascript
    // fastify or express in main.ts
    const server = require('fastify')();
    server.register(require('@fastify/static'), { root: path.join(__dirname, 'renderer') });
    server.listen({ port: 3000, host: '0.0.0.0' });
    ```
2.  **API**: You need to expose your `better-sqlite3` functions as REST API endpoints so the browser client can call them (since IPC only works for the local Electron window).
3.  **Frontend**:
    *   **Doctor (Electron)**: Uses direct IPC or connects to `localhost:3000`.
    *   **Front Desk (Browser)**: Connects to `http://DOCTOR_IP:3000`.

**Trade-off Summary**: You sacrifice "Offline Mode" for the Front Desk to gain massive "Simplicity".

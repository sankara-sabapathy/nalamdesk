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

## Security Considerations (Critical)

Examples below use loose settings for demonstration. For production deployment of the **Local Server** model:

1.  **Network Binding**: Do NOT bind to `0.0.0.0` unless strictly necessary. Bind to a specific interface or subnet range.
2.  **Firewall**: Configure host firewall to allow inbound traffic on port 3000 *only* from the Front Desk IP.
3.  **Authentication**: The server MUST implement auth protection (e.g., API Key, Token) via `server.addHook('onRequest')` to prevent unauthorized access to patient data.
4.  **TLS/HTTPS**: Use a self-signed certificate or internal CA to encrypt traffic between Front Desk and Doctor's PC. Plain HTTP is unsafe (leaks patient data on WiFi).
5.  **CORS**: Configure `@fastify/cors` to allow requests ONLY from the specific Front Desk origin.

---

## Technical Implementation for "Local Server"

If you choose the **Local Server** approach, the implementation changes:

1.  **Backend**: Your Electron app's Main process must start a minimal HTTP server.
    ```javascript
    // fastify or express in main.ts
    const path = require('path');
    const Database = require('better-sqlite3');
    let db;
    try {
      db = new Database('nalamdesk.db'); // Open DB instance
    } catch (err) {
      console.error('Failed to initialize database:', err);
      process.exit(1); // Gradeful exit or fallback
    }

    const server = require('fastify')();
    server.register(require('@fastify/static'), { root: path.join(__dirname, 'renderer') });
    
    // Check local subnet or bind specific IP
    server.listen({ port: 3000, host: '192.168.1.10' }, (err, address) => {
      if (err) console.error(err);
    });

    // Expose DB function
    server.get('/api/patients', async (req, reply) => {
        // Auth Check
        if (!req.headers['x-api-key']) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        try {
            // Async wrapper / Worker simulation
            const patients = await new Promise((resolve, reject) => {
                try {
                    const stmt = db.prepare('SELECT * FROM patients');
                    resolve(stmt.all());
                } catch (e) { reject(e); }
            });
            return patients;
        } catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: 'Database error' });
        }
    });
    ```
2.  **API**: You need to expose your `better-sqlite3` functions as REST API endpoints so the browser client can call them (since IPC only works for the local Electron window).
3.  **Frontend**:
    *   **Doctor (Electron)**: Uses direct IPC or connects to `localhost:3000`.
    *   **Front Desk (Browser)**: Connects to `http://DOCTOR_IP:3000`.

**Trade-off Summary**: You sacrifice "Offline Mode" for the Front Desk to gain massive "Simplicity".

# Developer Guide (Desktop)

## Setup
1.  **Prerequisites**: Node.js (v18+), python (for build tools), Visual Studio Build Tools (for native modules like `better-sqlite3`).
2.  **Install Dependencies**:
    ```bash
    cd desktop
    npm install
    ```

## Running Locally
```bash
npm start
```
This will:
1.  Start the Angular Dev Server (`ng serve`).
2.  Wait for port 4200.
3.  Launch Electron (`src/main/main.ts`).
4.  Launch the embedded Local Server (`src/server/app.ts`).

## Database
- **Development**: The database is located at `desktop/nalamdesk.db`.
- **Production**: `%APPDATA%\NalamDesk\nalamdesk.db`.
- **Tools**: Use `SQLite Viewer` extension or `DBeaver` to inspect `nalamdesk.db`.

## Build & Distribution
To build the Windows installer (`.exe`):
```bash
npm run dist:win
```
The output will be in `desktop/release/`.

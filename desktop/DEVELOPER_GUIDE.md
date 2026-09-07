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

## Authentication session boundary
- Renderer login calls `auth:login`, which sets `SessionService` in the main process.
- Renderer logout must call `auth:logout`, which runs `SessionService.clearSession()` (via `clearMainProcessSession`).
- Protected IPC is gated on that main-process principal. After logout those handlers fail with `Unauthorized` until a new login.
- Logout does **not** invent a second `closeDb` / restore-fence path. The device vault stays on the existing unlock contract; only the user principal is cleared.
- Reloading the window after logout must not restore the prior role: the principal is in-memory only, and the renderer lands on `/#/login`.

## Linux vault encryption
- At process start, main calls `preferLinuxGnomeLibsecret(app.commandLine)` so Electron OSCrypt uses `gnome-libsecret` without a user-facing CLI flag.
- `ElectronSafeStorageDeviceKeyStore` still rejects `basic_text` (`INSECURE_LINUX_BACKEND`).
- If encryption is still unavailable, setup/login surfaces `ENCRYPTION_UNAVAILABLE` naming gnome-libsecret / `libsecret-1-0` / gnome-keyring. There is no second crypto stack.

## Application version
- Settings reads a single IPC, `app:getVersion`, backed by packaged `app.getVersion()` plus `build-identity.json` (commit / CI run id when stamped).
- Development builds append `(development)` to the displayed version.
- `npm run build` stamps `desktop/build-identity.json`. Feature CI asserts artifact names, electron-builder `latest*.yml`, identity, and displayed version agree (`npm run assert:packaged-version`).

## Build & Distribution
Output is `desktop/release/`.

```bash
npm run dist:win     # Windows NSIS installer
npm run dist:mac     # macOS DMG
npm run dist:linux   # Linux .deb (primary clinic artifact) + AppImage (secondary)
```

Linux clinic install is the `.deb`:

```bash
sudo apt install ./nalamdesk-desktop_<version>_amd64.deb
```

The AppImage requires FUSE 2 (`libfuse.so.2`). If FUSE is missing, use `run-nalamdesk-appimage.sh` (fails with an actionable `.deb` message) or install the `.deb`. Do not document or use squashfs extract / `--appimage-extract` as an install path.

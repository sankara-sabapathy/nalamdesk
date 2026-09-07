### 2026-09-07 22:39 IST — Booking
- Slice: Settings footer / AC #22 retest (PR 44, Feature CI run 34146414001, kick SHA `7b046226`, `.deb` Version `0.0.8`)
- What: Settings shows real packaged version, not bare `NalamDesk` / not `v0.0.0`
- Expected: packaged version in Admin Center footer (e.g. `NalamDesk v0.0.8` or with commit)
- Actual: **PASS.** Settings → Admin Center → General footer reads **`NalamDesk v0.0.8 (6a10332)`**. Note: packaged `build-identity.json` commit is `6a10332`, not the kick head `7b046226` (artifact still from run 34146414001). Prior BLOCK on `2a01e9fe` was bare `NalamDesk` with no version.
- Category: Worked
- Severity: PASS
- Screenshot: `/workspace/nalamdesk-test/screenshots/pr44-22-settings-version-7b046226.png`

---

### 2026-09-07 22:35 IST — Booking
- Slice: Settings footer / AC #22 (PR 44, SHA `2a01e9fe`, Feature CI run 34144426514, `.deb` Version `0.0.8`)
- What: Settings shows real packaged version, not `v0.0.0`
- Expected: Settings footer shows packaged version (e.g. `NalamDesk v0.0.8`)
- Actual: **FAIL / BLOCK.** Settings → Admin Center → General. Footer under Admin Center reads only **`NalamDesk`** — no version number at all (neither `v0.0.8` nor the old `v0.0.0`). Package metadata is Version `0.0.8`. Logged in as admin; clinic Nalamdesk Test Clinic.
- Category: Defect
- Severity: P2 (AC #22 BLOCK)
- Screenshot: `/workspace/nalamdesk-test/screenshots/pr44-22-settings-version.png`

---

## Backend / platform

---

### 2026-09-07 22:30 IST — Clinical (PR 44)
- Slice: #9 Logout
- What: after logout, protected session cleared; login land
- Expected: Logout clears session; Login shown; no prior role without re-auth
- Actual: **PASS.** Electron `.deb` (Feature CI 34144426514 / SHA `2a01e9fe`). Logged in admin → Dashboard AD/Administrator → AD menu **Logout** → Login (Username, Password, Login, Recover Device). Session cleared.
- Category: Worked
- Screenshot: `/workspace/nalamdesk-test/screenshots/pr44-9-logout.png`

---

### 2026-09-07 22:34 IST — Resilience
- Slice: Linux packaging / AC #35 (PR 44, SHA `2a01e9fe`, Feature CI run 34144426514)
- What: documented `.deb` path starts the app (not AppImage extract)
- Expected: clinic install via `LINUX-INSTALL.txt` (`.deb`) launches NalamDesk; AppImage is secondary and must not be the squashfs-extract install path
- Actual: **PASS.** Artifact includes `LINUX-INSTALL.txt` (`sudo apt install ./nalamdesk-desktop_0.0.8_amd64.deb` or `dpkg -i`). Packaged binary is `/opt/NalamDesk/nalamdesk-desktop`. `sudo dpkg -i` installed `nalamdesk-desktop` 0.0.8 system-wide (`update-alternatives` → `/usr/bin/nalamdesk-desktop`). Electron Welcome wizard started from the `.deb` binary path (`--no-sandbox --password-store=gnome-libsecret`). AppImage without FUSE fails; wrapper/`APPIMAGE-FUSE.txt` tell clinics to install the `.deb` and not `--appimage-extract`.
- Category: Worked
- Severity: PASS
- Screenshot: `/workspace/nalamdesk-test/screenshots/pr44-35-deb-starts.png`

---

### 2026-09-07 22:34 IST — Resilience
- Slice: first-run encryption / AC #36 (PR 44, SHA `2a01e9fe`, Feature CI run 34144426514)
- What: Save & Secure encrypts with keyring available (reject `basic`)
- Expected: with gnome-libsecret / keyring available, Secure Vault completes; missing backend would name keyring/fix (not vague); `--password-store=basic` rejected
- Actual: **PASS.** Fresh `XDG_CONFIG_HOME=/workspace/nalamdesk-pr44-resilience/config`, launched with `--password-store=gnome-libsecret`. Get Started → vault password → clinic → **Setup Complete!** with recovery code `663A11ED-842F84F4-D0B96EAB-35B79AED`. `security.json` device.provider=`electron-safe-storage`; recovery `aes-256-gcm` / `argon2id`. No `ENCRYPTION_UNAVAILABLE`. No Drive.
- Category: Worked
- Severity: PASS
- Screenshot: `/workspace/nalamdesk-test/screenshots/pr44-36-save-secure.png`

---

## Out of scope (cloud / Drive)
Do not test. Known leftovers only:
- BACKUP_ERROR “Cloud backup failed: Not authenticated” when Drive is disconnected
- `cloud:*` restore fence residual
- Failed Drive download overwrite / no rollback

---

## Raw log
Testers: paste extra notes below if they do not fit a category yet.
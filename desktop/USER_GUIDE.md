# NalamDesk User Guide 📖

Welcome to **NalamDesk**, your secure, offline-first Clinic Management System. This guide will help you set up and use the application effectively.

## 🚀 Getting Started

### 1. Installation
*   **Windows:** Download the installer (`.exe`) and follow the on-screen prompts.
*   **macOS:** Download the `.dmg`, open it, and drag NalamDesk into Applications.
*   **Linux (clinic install):** Download the `.deb` package and install it. Do not extract an AppImage.
    ```bash
    sudo apt install ./nalamdesk-desktop_*_amd64.deb
    ```
    If `apt` is unavailable:
    ```bash
    sudo dpkg -i nalamdesk-desktop_*_amd64.deb
    sudo apt-get install -f
    ```
    Then launch **NalamDesk** from the applications menu.
*   An AppImage may be published as a secondary artifact. It requires FUSE 2 (`libfuse.so.2`). If it fails to start, install the `.deb` — do not extract the squashfs.

### 2. First Run & Security
*   **Create administrator password:** On first launch, the setup wizard creates the encrypted vault on this device and an administrator login.
*   **Linux keyring:** Vault encryption uses the system keyring (`gnome-libsecret`). Install `libsecret-1-0` and `gnome-keyring` if setup reports `ENCRYPTION_UNAVAILABLE`. Do not use `--password-store=basic`.
*   **Recovery code:** Save the recovery code shown at the end of setup. It is required to recover the device.
*   **Login:** Sign in with your username and password. Logout clears the main-process session so the previous role cannot be reused.

---

## 🩺 Features Overview

### 1. Patient Management
*   **Search:** Use the search bar to find patients by Name or Mobile Number.
*   **Registration:** Click **"New Patient"** to register a walk-in patient. All standard fields (Name, DOB, Mobile, etc.) are available.
*   **Edit:** You can update patient details at any time from their profile.

### 2. Queue Management
*   **Live Queue:** The dashboard shows the current list of waiting patients.
*   **Status Indicators:**
    *   🟢 **Waiting:** Patient is in the lobby.
    *   🟡 **In-Consult:** Patient is currently seeing the doctor.
    *   ✅ **Completed:** Consultation finished.
*   **Actions:** You can remove patients from the queue or move them to "In-Consult".

### 3. Doctor's Workbench
*   **Timeline:** View a patient's entire medical history (previous visits, prescriptions) in a chronological timeline.
*   **Prescription Pad:**
    *   **Diagnosis:** Enter clinical notes and diagnosis.
    *   **Medicines:** Search and add medicines with dosage instructions (e.g., "1-0-1", "After Food").
    *   **Print:** Click "Print" to generate a professional PDF prescription instantly.

### 4. Online Booking (Cloud Sync) ☁️
*   **Overview:** NalamDesk allows patients to book appointments online via a public link. These appointments automatically appear in your Desktop App.
*   **How to Enable:**
    1.  Go to **Settings > Cloud Sync**.
    2.  Toggle **"Enable Online Booking"**.
    3.  Enter your **Clinic Name** and **City**.
    4.  Click **"Save"**.
*   **The Flow:**
    1.  **Patient Books:** Uses your public link to book a slot.
    2.  **Sync:** The appointment appears on your **Dashboard** under "Today's Appointments" in ~30 seconds.
    3.  **Check-In:** 
        *   When the patient arrives, click **"Check In"** on the Dashboard card.
        *   **Validation:** If it's a new patient, you will be prompted to verify/fill missing details (Age/Gender).
        *   **Queue:** Once validated, the patient is added to the **Live Queue** and status updates to "Checked In".

---

## ⚙️ Settings

### General
*   **Theme:** Switch between Light, Dark, and High-Contrast modes.
*   **Clinic Details:** Update your clinic's name and address (appears on prescriptions).
*   **Application version:** The Settings footer shows the packaged application version from Electron (`app.getVersion()`), plus a short commit when the build embeds one. Development builds are labeled `(development)`.

### Data Management
*   **Backup:** Automated daily backups are saved locally (Settings → Data & Backup). Retention is 30 days.
*   **Restore (after first run):** Settings → **Data & Backup** → **Restore from Backup File**. Choose a `.ndbackup`, enter the Recovery Code and the current administrator password. This is the same gated restore as the Welcome screen; the app restarts after a successful restore.
*   **Google Drive:** Link your Google Account to enable **Automated Daily Backups** (runs every day at 10 PM if the app is open).
*   **Crash Reporting:** If the application closes unexpectedly, you will see a popup asking to "Save Crash Report". Please save this file and email it to support for analysis. Your data remains private; the report only contains error details, not patient records.

---

## ❓ FAQ

**Q: Is my data safe?**
A: Yes. Your data is stored **locally** on your device and encrypted with your password. Even if you use Cloud Sync, only appointment details are temporarily synchronized; your core medical records remain offline and encrypted.

**Q: Can I use NalamDesk without internet?**
A: **Yes!** NalamDesk is "Offline-First". You can do everything (Queue, Consult, Print) without internet. You only need internet if you want to receive Online Bookings.

**Q: I forgot my password.**
A: Unfortunately, there is no reset. Since we don't store your password, we cannot recover it. Please keep it safe.

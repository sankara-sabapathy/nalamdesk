# NalamDesk User Guide 📖

Welcome to **NalamDesk**, your secure, offline-first Clinic Management System. This guide will help you set up and use the application effectively.

## 🚀 Getting Started

### 1. Installation
*   Download the latest installer for your operating system (Windows/macOS).
*   Run the installer and follow the on-screen prompts.
*   Once installed, launch **NalamDesk** from your desktop or start menu.

### 2. First Run & Security
*   **Create Vault:** On the first launch, you will be asked to create a **Vault Password**.
*   **⚠️ IMPORTANT:** This password is used to encrypt your database. **We do not store it.** If you lose this password, your data is lost forever.
*   **Login:** Use your Vault Password to unlock the application every time you open it.

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

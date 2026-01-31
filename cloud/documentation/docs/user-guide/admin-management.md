---
sidebar_position: 2
---

# Admin Management

The Admin Dashboard allows you to configure your clinic settings and manage staff access.

## Accessing Settings
1. Click on the **Settings** icon in the main navigation bar.
2. Ensure you are logged in as an **Admin**.

## Clinic Details
In the **General** tab:
- **Clinic Name**: Enter the name of your practice. This will appear on reports and the dashboard.
- **Save Details**: Click to apply changes.

## User Management
In the **Users** tab (Admin only):

### Adding a New User
1. Click the **+ Add User** button.
2. Fill in the details:
    - **Username**: Unique login ID (e.g., `dr_smith`).
    - **Name**: Full display name.
    - **Role**: Select `Doctor`, `Receptionist`, or `Nurse`.
    - **Specialty/License**: Required for Doctors.
    - **Password**: Set a temporary password.
3. Click **Save**.

### Managing Existing Users
- **Edit**: Click to update details or reset passwords.
- **Delete**: Remove a user from the system (Soft delete).

## Cloud Backup & Restore
NalamDesk supports secure backups to Google Drive.

### Connecting Google Drive
1. Go to **Settings > General > Cloud Connection**.
2. Click **Connect Google Drive**.
3. Follow the authentication prompt.
4. Once connected, you will see a "Connected" status.

### Creating a Backup
- Click **Backup Now** to immediately upload a snapshot of your encrypted database to the cloud.

### Restoring from Backup
> [!WARNING]
> Restoring will overwrite all current local data. Proceed with caution.

1. Click **Refresh List** to see available backups.
2. Click **Restore** next to the desired backup file.
3. Confirm the action. The app will restart with the restored data.

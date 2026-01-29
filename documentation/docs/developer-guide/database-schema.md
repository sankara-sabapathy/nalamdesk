---
sidebar_position: 2
---

# Database Schema

NalamDesk uses a relational SQLite database. Below is the schema definition for core tables.

## Users Table
Stores credentials and profile information for all system users (Doctors, Staff, Admin).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto-incrementing ID. |
| `username` | TEXT UNIQUE | login username. |
| `password` | TEXT | Argon2 Hash of the password. |
| `role` | TEXT | `admin`, `doctor`, `receptionist`, `nurse`. |
| `name` | TEXT | Display name. |
| `specialty` | TEXT | Doctor's specialty (e.g., General Physician). |
| `license_number` | TEXT | Medical license number. |
| `active` | INTEGER | `1` for active, `0` for soft-delete. |

## Patients Table
Core patient registry.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique Patient ID. |
| `uuid` | TEXT UNIQUE | System-generated UUID for syncing. |
| `name` | TEXT | Patient Name. |
| `mobile` | TEXT | Contact Number. |
| `age` | INTEGER | Age in years. |
| `gender` | TEXT | `Male`, `Female`, `Other`. |
| `address` | TEXT | Residential address. |

## Visits Table
Records clinical encounters.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Visit ID. |
| `patient_id` | INTEGER FK | Links to `patients.id`. |
| `doctor_id` | INTEGER FK | Links to `users.id` (The doctor). |
| `date` | DATETIME | Timestamp of the visit. |
| `diagnosis` | TEXT | Medical diagnosis notes. |
| `prescription_json` | TEXT | JSON string array of medicines. |
| `amount_paid` | REAL | Consultation fee collected. |

## Patient Queue Table
Manages the daily patient flow.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Queue entry ID. |
| `patient_id` | INTEGER FK | Links to `patients.id`. |
| `status` | TEXT | `waiting`, `in-consult`, `completed`. |
| `priority` | INTEGER | `1` (Normal), `2` (Emergency). |

## Audit Logs Table
Tracks critical system actions for security and compliance.

| Column | Type | Description |
| :--- | :--- | :--- |
| `action` | TEXT | `INSERT`, `UPDATE`, `DELETE`. |
| `table_name` | TEXT | Target table (e.g., `patient_queue`). |
| `user_id` | INTEGER | ID of the user who performed the action. |
| `details` | TEXT | Description of the change. |

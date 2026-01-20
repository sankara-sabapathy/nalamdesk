# NalamDesk 🏥

**NalamDesk** is a secure, offline-first Clinic Management System designed for doctors who prioritize data privacy and ownership. Built with a "Zero-Knowledge" architecture, it ensures that sensitive patient data is encrypted at rest and accessible only to the holder of the vault password.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 🌟 Key Features

### 🔒 Zero-Knowledge Security
- **Local-Only Storage**: Data is stored in a `SQLite` database on your local machine. No remote servers, no cloud dependency by default.
- **Strong Encryption**: The database is encrypted using **SQLCipher** (AES-256).
- **Argon2id KDF**: Your vault password *is* the encryption key source. We do not store your password. If you lose it, the data is unrecoverable (by design).

### 🩺 Clinic Operations
- **Patient Management**: Fast registration and search.
- **Doctor's Workbench**:
    - **Timeline View**: See patient visit history at a glance.
    - **Prescription Pad**: Digital prescription writing (Diagnosis, Medicines, Dosage).
    - **PDF Generation**: Print professional prescriptions instantly.

### ☁️ Cloud Resilience
- **Google Drive Backup**: Optional integration to securely backup your *encrypted* database to your personal Google Drive.
- **Restore**: Easily restore your data on a new device.

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) (Desktop Container)
- **Frontend**: [Angular v17+](https://angular.io/) (Standalone Components, TailwindCSS)
- **Database**: [better-sqlite3-multiple-ciphers](https://github.com/m4heshd/better-sqlite3-multiple-ciphers) (SQLCipher)
- **Security**: [argon2](https://github.com/ranisalt/node-argon2) (Key Derivation)
- **PDF**: [pdfmake](http://pdfmake.org/)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (required for building native modules like `better-sqlite3` and `argon2`)
- Visual Studio Build Tools (Windows) or Xcode (macOS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nalamdesk.git
   cd nalamdesk
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Google Drive Setup (Optional)**
   To enable Cloud Backup, you need to create a project in [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Drive API**, and create OAuth 2.0 Credentials.
   
   Update `src/main/services/GoogleDriveService.ts`:
   ```typescript
   const CLIENT_ID = 'YOUR_CLIENT_ID';
   const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
   ```

### Development

Run the Angular renderer and Electron main process concurrently:

```bash
npm start
```

### Build for Production

This will produce an installer/executable in the `dist/` or `out/` directory.

```bash
npm run pack
```

## ⚠️ Security Warning

**NalamDesk does not know your password.**
There is no "Forgot Password" feature. Your password is used to mathematically derive the encryption key that opens your database. 
- **Do not lose your password.**
- **Do not share your password.**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

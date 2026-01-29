# NalamDesk 🏥

**NalamDesk** is a secure, offline-first Clinic Management System designed for doctors who prioritize data privacy. Built with a "Zero-Knowledge" architecture, it ensures that medical data is encrypted locally and accessible only to you.

![License](https://img.shields.io/badge/license-AGPLv3-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 📚 Documentation

*   **[User Guide](USER_GUIDE.md):** For Doctors & Clinic Staff. (Features, Settings, Online Booking)
*   **[Developer Guide](DEVELOPER_GUIDE.md):** For Contributors. (Architecture, Setup, Sync Protocol)

## ✨ Key Highlights

*   **🔒 Zero-Knowledge Security:** AES-256 Encryption with Argon2id. Your password is the key.
*   **⚡ Offline-First:** Works perfectly without internet.
*   **☁️ Hybrid Cloud Sync:** Optional "Online Booking" module that securely syncs appointments to your offline desktop.
*   **🛡️ Robust Security:** Advanced Role-Based Access Control (RBAC) and automated encrypted backups.
*   **🚀 Modern Stack:** Electron, Angular v17+, SQLite, Node.js.

## 🚀 Quick Start

1.  **Install:**
    ```bash
    npm install
    ```
2.  **Run:**
    ```bash
    npm start
    ```
3.  **Build:**
    ```bash
    npm run pack
    ```

## ⚠️ Security Warning
**Do not lose your Vault Password.** We cannot recover it for you.

## 📄 License
AGPLv3 License - see [LICENSE](LICENSE).

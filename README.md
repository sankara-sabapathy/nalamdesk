# NalamDesk 🏥

**NalamDesk** is a privacy-focused Medical Practice Management System that works offline-first (Desktop) with optional Cloud Sync.

## Architecture
The project is split into two domains:

1.  **Desktop App** (`/desktop`): The core Electron application running locally. Stores data in SQLite.
2.  **[Cloud Platform](./cloud/README.md)** (`/cloud`): The remote infrastructure (API + Web) for syncing and patient access.

## Desktop Development Setup 💻

Follow these steps to set up the development environment from a clean repository.

### Prerequisites
- **Node.js**: LTS version (v18+ recommended).
- **Git**: For version control.
- **Windows Build Tools**: Required for compiling native modules like `better-sqlite3`.
    - Install via admin PowerShell: `npm install --global --production windows-build-tools`
    - OR install "Desktop development with C++" workload via Visual Studio Installer.

### Setup Instructions

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/sankara-sabapathy/nalamdesk.git
    cd nalamdesk/desktop
    ```

2.  **Install Dependencies**
    This will also trigger `electron-builder install-app-deps` to recompile native modules for Electron.
    ```bash
    npm install
    ```

3.  **Run the Application**
    This command compiles CSS, starts the Angular renderer, and launches Electron.
    ```bash
    npm start
    ```

### Troubleshooting
- **Missing Styles/Tailwind**:
    - If the UI looks unstyled, manually rebuild the CSS:
      ```bash
      npm run build:css
      ```
- **Native Module Errors (`better-sqlite3`)**:
    - Ensure you have the Windows Build Tools installed.
    - Re-run `npm run postinstall` to rebuild modules against the Electron header files.
- **Database**:
    - A local SQLite database `nalamdesk.db` is automatically created in the `desktop` directory (dev) or `%APPDATA%` (prod) on first run.

## Cloud Deployment
Deployment is managed via Terraform in `cloud/infrastructure`.
```bash
cd cloud/infrastructure
terraform init
terraform apply
```

## Documentation
## Documentation
See `cloud/documentation` for full architectural details.
See **[Testing Strategy](./cloud/documentation/docs/developer-guide/testing-strategy.md)** for detailed Testing Architecture.

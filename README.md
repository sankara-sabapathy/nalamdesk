# NalamDesk 🏥

**NalamDesk** is a privacy-focused Medical Practice Management System that works offline-first (Desktop) with optional Cloud Sync.

## Architecture
The project is split into two domains:

1.  **[Desktop App](./desktop/README.md)** (`/desktop`): The core Electron application running locally. Stores data in SQLite.
2.  **[Cloud Platform](./cloud/README.md)** (`/cloud`): The remote infrastructure (API + Web) for syncing and patient access.

## Quick Start (Desktop)
```bash
cd desktop
npm install
npm start
```

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

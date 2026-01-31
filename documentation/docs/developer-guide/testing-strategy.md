---
sidebar_position: 4
---

# Testing Strategy

NalamDesk employs a "Battle-Tested" testing strategy aiming for **101% coverage** of critical business logic. We use a combination of Unit, Integration, and End-to-End (E2E) tests.

## 🧪 Unit & Integration Tests

We use **Vitest** for unit and integration testing.

- **Backend Tests** (`src/main/**/*.spec.ts`): Run in a Node.js environment.
- **Frontend Tests** (`src/renderer/**/*.spec.ts`): Run in a JSDOM environment.

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests with UI
npm run test -- --ui
```

### Key Components Tested
- **Services**: `DatabaseService`, `SecurityService`, `AuthService`, `DataService`
- **Components**: Login, Dashboard, Patient List, Visits, Settings

---

## 🎭 End-to-End (E2E) Tests

We use **Playwright** with Electron support for E2E testing.

### Test Database Isolation
To ensure data safety, E2E tests run against a **transient test database** (`nalamdesk-test.db`) instead of your production data.
- The app automatically detects `NODE_ENV='test'` and switches to the test database.
- Internal API server runs on `localhost:3000` to bypass file protocol issues.

### Running E2E Tests

> **⚠️ Important**: You must close all running instances of NalamDesk before running E2E tests due to the Single-Instance Lock.

1. **Build the Main Process**:
   ```bash
   npm run build:main
   ```

2. **Run Playwright**:
   ```bash
   npm run e2e
   ```

3. **View Report (on failure)**:
   ```bash
   npx playwright show-report
   ```

---

## 🔄 CI/CD Integration

Tests are automatically executed via GitHub Actions on every push to feature branches.
- **Workflow**: `feature-ci.yml`
- **Gate**: All unit tests must pass for the build to succeed.

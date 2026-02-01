---
sidebar_position: 4
---

# Testing Strategy 🧪

NalamDesk employs a "Battle-Tested" testing strategy tailored to its hybrid architecture. We aim for **101% coverage** of critical business logic using a combination of specialized test runners for each domain.

## 1. Desktop Application (`/desktop`)

The Desktop app runs on Electron and uses **Vitest** (powered by AnalogJS). To handle the complexity of testing Angular components within an Electron environment, we utilize a **Dual-Environment Architecture**.

### A. Mixed Integration Tests (Legacy/DOM)
Used for testing component templates, complex DOM interactions, and integration with Angular's `TestBed`.

- **Configuration**: `vitest.config.renderer.mjs`
- **Setup File**: `src/test-setup.ts`
- **Environment**: Loads `zone.js` and `TestBed`.
- **Use Case**: UI testing, Directive testing.
- **Run Command**:
  ```bash
  npm run test:renderer
  ```

### B. Pure Unit Tests (Business Logic)
Used for high-speed testing of component logic, services, and state management without the overhead of the DOM or Zone.js.

- **Configuration**: `vitest.config.pure.mjs`
- **Setup File**: `src/test-setup-pure.ts`
- **Environment**: **NO Zone.js**. Fast JIT compilation only.
- **Methodology**: Uses **Constructor Injection** and **Manual Instantiation** (e.g., `new Component(...)`).
- **Use Case**: Queue algorithms, Patient Data helpers, Service logic.
- **Run Command**:
  ```bash
  npx vitest run -c vitest.config.pure.mjs
  ```

> **Why two environments?**
> Zone.js is required for Angular's reactivity but conflicts with Vitest's async/await handling in certain scenarios. By separating pure logic tests into a "Pure" environment, we achieve faster execution and eliminate "ProxyZone" errors.

---

## 2. Cloud Web Platform (`/cloud/web`)

The Cloud Web application is a standard Angular PWA. It uses the traditional Angular CLI testing stack.

- **Test Runner**: **Karma** & **Jasmine**
- **Configuration**: `karma.conf.js`
- **Methodology**: Standard Angular `TestBed` testing.
- **Run Command**:
  ```bash
  ng test
  ```

---

## 3. Cloud API (`/cloud/api`)

The Cloud API is a Node.js Fastify server.

*(Testing framework pending implementation - likely Node Tap or Vitest)*

---

## 4. End-to-End (E2E) Tests

We use **Playwright** with Electron support for full-system verification.

### Isolation
E2E tests run against a **Transient Test Database** (`nalamdesk-test.db`) to ensure your production data is never touched.

### Running E2E
```bash
# 1. Close all NalamDesk instances
# 2. Build the main process
npm run build:main

# 3. Run Playwright
npm run e2e
```

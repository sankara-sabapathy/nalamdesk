---
sidebar_position: 4
---

# Testing Strategy 🧪

NalamDesk employs a "Battle-Tested" testing strategy tailored to its hybrid architecture. We aim for **101% coverage** of critical business logic using a combination of specialized test runners for each domain.

## 1. Desktop Application (`/desktop`)

The Desktop app runs on Electron and uses **Vitest** (powered by AnalogJS). To handle the complexity of testing Angular components within an Electron environment, we utilize a **Dual-Environment Architecture**.

### Unit Testing Strategy
Due to the complex interaction between Angular's `zone.js` and the Vitest JSDOM environment (specifically `ProxyZone` limitations), we enforce a **Manual Instantiation** strategy for business logic.

#### A. Manual Component Instantiation ("Isolated Testing")
This is the **primary** method for testing Angular components in this project.
- **Why**: Bypasses unstable `TestBed` and `ProxyZone` issues.
- **How**: Instantiate the component class directly with mocked dependencies.
- **Focus**: Pure business logic, input validation, service calls.

**Example**:
```typescript
// GOOD: Stable & Fast
beforeEach(() => {
    mockService = { getData: vi.fn() };
    component = new MyComponent(mockService);
});
```

#### B. Integration Testing
Since unit tests do not render the template, we rely on **Playwright** (E2E) to verify DOM rendering, bindings, and user interactions.

### Running Tests
```bash
# Run all renderer tests
npm run test:renderer

# Run specific file
npx vitest run src/renderer/app/login/login.component.spec.ts
```

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

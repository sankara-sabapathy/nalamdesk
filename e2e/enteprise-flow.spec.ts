
import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';

test('HMR Workflow: Queue to Prescription', async () => {
    // Launch Electron app
    const app = await electron.launch({
        args: [join(__dirname, '../dist/main/main.js')],
        env: { ...process.env, NODE_ENV: 'test' }
    });

    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Login
    await window.fill('input[type="password"]', 'password'); // assuming mock auth or default
    await window.click('button:has-text("Login")');

    // Dashboard
    await expect(window.locator('div.text-3xl')).toBeVisible(); // Welcome message

    // Check Queue Widget
    const queueElement = window.locator('h2:has-text("Patient Queue")');
    await expect(queueElement).toBeVisible();
    await queueElement.click();

    // Queue Page
    await expect(window.locator('h2', { hasText: 'Patient Queue' })).toBeVisible();

    // Close app
    await app.close();
});

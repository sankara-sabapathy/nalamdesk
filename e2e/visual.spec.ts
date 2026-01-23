import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
    test('dashboard should match snapshot', async ({ page }) => {
        // Navigate to app (assuming served at standard URL)
        await page.goto('/');

        // Login flow if needed (or mock local storage/auth)
        // For now, let's assume we land on a login page or the dashboard if guarded
        if (page.url().includes('login')) {
            await page.fill('input[type="text"]', 'admin');
            await page.fill('input[type="password"]', 'admin');
            await page.click('button[type="submit"]');
            await page.waitForURL('**/dashboard');
        }

        // Wait for the main layout to be visible
        await expect(page.locator('app-main-layout')).toBeVisible();

        // Take a screenshot of the entire page
        await expect(page).toHaveScreenshot('dashboard-full.png', {
            maxDiffPixels: 100 // Allow tiny rendering differences
        });
    });

    test('sidebar menu items should render correctly', async ({ page }) => {
        await page.goto('/dashboard');
        if (page.url().includes('login')) {
            await page.fill('input[type="text"]', 'admin');
            await page.fill('input[type="password"]', 'admin');
            await page.click('button[type="submit"]');
            await page.waitForURL('**/dashboard');
        }

        const sidebar = page.locator('.drawer-side .menu');
        await expect(sidebar).toBeVisible();

        // Specific check for the 'active' link color - should be blue bg, white text
        const activeLink = sidebar.locator('a.active');
        await expect(activeLink).toHaveCSS('background-color', 'rgb(24, 104, 219)'); // #1868db
        await expect(activeLink).toHaveCSS('color', 'rgb(255, 255, 255)');
    });
});

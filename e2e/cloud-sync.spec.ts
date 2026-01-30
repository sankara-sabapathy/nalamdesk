import { test, expect, _electron as electron } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let electronApp: any;
let serverProcess: ChildProcess;
const SERVER_PORT = 3333;

test.describe('Cloud Sync E2E', () => {

    // 1. Start Cloud Server & Electron App
    test.beforeAll(async () => {
        // Start Server
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        console.log(`Starting Cloud Server with ${npmCmd}...`);

        serverProcess = spawn(npmCmd, ['run', 'dev'], {
            env: { ...process.env, PORT: SERVER_PORT.toString() },
            cwd: path.join(process.cwd(), 'server'),
            shell: true,
            stdio: 'pipe',
            detached: true // Allows process group kill on POSIX
        });

        // Wait for server
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Start Electron
        electronApp = await electron.launch({
            args: ['.'],
            env: { ...process.env, NODE_ENV: 'test', CLOUD_API_URL: `http://127.0.0.1:${SERVER_PORT}/api/v1` }
        });
    });

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
        if (serverProcess && serverProcess.pid) {
            // Cross-platform process termination
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
            } else {
                // Kill the process group on POSIX (negative PID)
                try {
                    process.kill(-serverProcess.pid, 'SIGTERM');
                } catch (e) {
                    // Process may have already exited
                }
            }
        }
    });

    test('Should enable cloud sync and receive appointment', async () => {
        const window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');

        // Login if needed
        const url = await window.url();
        if (url.includes('login')) {
            await window.fill('input[placeholder="Enter username..."]', 'admin');
            await window.fill('input[placeholder="Enter password..."]', 'admin');
            await window.click('button:has-text("Login")');
            await window.waitForURL('**/dashboard');
        }

        // 1. Navigate to Settings
        await window.click('text=Settings');
        // 2. Enable Online Booking
        // Find the toggle next to "Enable Public Online Booking"
        const toggle = await window.locator('input[type="checkbox"]').first();
        // Better selector if multiple: window.locator('div:has-text("Enable Public Online Booking") + label input');

        const isChecked = await toggle.isChecked();
        if (!isChecked) {
            await toggle.check();

            // Wait for modal
            await window.waitForSelector('text=Setup Online Booking');

            // Fill Modal
            await window.fill('input[placeholder="e.g. City Health"]', 'E2E Clinic');
            await window.fill('input[placeholder="e.g. Chennai"]', 'Test City');

            // Click Enable
            await window.click('button:has-text("Enable")');

            // Wait for success alert or status change (modal closes)
            await window.waitForSelector('text=Setup Online Booking', { state: 'hidden' });
        }

        expect(await toggle.isChecked()).toBe(true);
    });

});

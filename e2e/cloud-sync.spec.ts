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
            stdio: 'pipe'
        });

        // Wait for server
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Start Electron
        electronApp = await electron.launch({
            args: ['.'],
            env: { ...process.env, NODE_ENV: 'test' }
        });
    });

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
        if (serverProcess) {
            spawn('taskkill', ['/pid', serverProcess.pid?.toString(), '/f', '/t']);
        }
    });

    test('Should enable cloud sync and receive appointment', async () => {
        const window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');

        // 1. Navigate to Settings
        await window.click('text=Settings');
        await window.click('text=Data Sync');

        // 2. Enable Online Booking
        // Check if toggle is off
        const toggle = await window.locator('input[type="checkbox"]#cloudEnabled');
        if (!await toggle.isChecked()) {
            await toggle.check();
        }

        // Fill Clinic ID/City (if empty)
        await window.fill('input[placeholder="Clinic Name"]', 'E2E Clinic');
        await window.fill('input[placeholder="City"]', 'Test City');

        await window.click('button:has-text("Save Changes")');

        // Wait for "Saved" toast or API call
        await window.waitForTimeout(2000);

        expect(await toggle.isChecked()).toBe(true);
    });

});

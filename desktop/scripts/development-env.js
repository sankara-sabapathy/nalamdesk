const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function loadDevelopmentEnv() {
    const repoRoot = path.resolve(__dirname, '../..');
    dotenv.config({ path: path.join(repoRoot, '.env.development') });

    const localEnv = path.join(repoRoot, '.env.local');
    if (fs.existsSync(localEnv)) {
        dotenv.config({ path: localEnv, override: true });
    }
}

function getDesktopAngularPort() {
    loadDevelopmentEnv();
    const rawPort = process.env.NALAMDESK_DESKTOP_ANGULAR_PORT;
    const port = Number(rawPort || 4200);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid NALAMDESK_DESKTOP_ANGULAR_PORT: ${rawPort}`);
    }
    return port;
}

module.exports = { getDesktopAngularPort };

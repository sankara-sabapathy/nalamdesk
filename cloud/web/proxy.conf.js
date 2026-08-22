const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const repoRoot = path.resolve(__dirname, '../..');
loadEnvFile(path.join(repoRoot, '.env.development'), false);

const localEnv = path.join(repoRoot, '.env.local');
if (fs.existsSync(localEnv)) {
    loadEnvFile(localEnv, true);
}

function loadEnvFile(filePath, override) {
    if (!fs.existsSync(filePath)) return;

    for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(filePath, 'utf8')))) {
        if (override || process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

const rawPort = process.env.NALAMDESK_CLOUD_API_PORT;
const port = Number(rawPort || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid NALAMDESK_CLOUD_API_PORT: ${rawPort}`);
}

module.exports = {
    '/api': {
        target: `http://127.0.0.1:${port}`,
        secure: false,
        changeOrigin: true,
    },
};

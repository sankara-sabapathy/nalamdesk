const { spawnSync } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const result = spawnSync(electron, [
    vitest,
    'run',
    '-c',
    'vitest.config.main.js',
    'src/main/services/SecurityService.integration.spec.ts',
    'src/main/services/BackupService.integration.spec.ts',
    '--reporter=default'
], {
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

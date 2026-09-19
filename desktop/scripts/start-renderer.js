const { spawn } = require('node:child_process');
const { getDesktopAngularPort } = require('./development-env');

const port = getDesktopAngularPort();
const ngCommand = process.platform === 'win32' ? 'ng.cmd' : 'ng';
const child = spawn(ngCommand, ['serve', '--open=false', '--host', '127.0.0.1', '--port', String(port)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

child.on('error', (error) => {
    console.error('[Desktop Dev] Failed to start Angular:', error);
    process.exitCode = 1;
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exitCode = code ?? 1;
});

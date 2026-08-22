const waitOn = require('wait-on');
const { getDesktopAngularPort } = require('./development-env');

const port = getDesktopAngularPort();

waitOn({ resources: ['dist/main/main.js', `http://127.0.0.1:${port}`] })
    .catch((error) => {
        console.error('[Desktop Dev] Renderer did not become ready:', error);
        process.exitCode = 1;
    });

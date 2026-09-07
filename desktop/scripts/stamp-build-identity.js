#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pkg = require('../package.json');

function resolveCommit() {
    if (process.env.NALAMDESK_BUILD_COMMIT) return process.env.NALAMDESK_BUILD_COMMIT;
    if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
    try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return null;
    }
}

const identity = {
    version: pkg.version,
    commit: resolveCommit(),
    buildId: process.env.GITHUB_RUN_ID || process.env.NALAMDESK_BUILD_ID || null
};

const dest = path.join(__dirname, '..', 'build-identity.json');
fs.writeFileSync(dest, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`[stamp-build-identity] ${dest} version=${identity.version} commit=${identity.commit || 'none'}`);

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    assertPackagedVersionAgreement,
    readReleaseAgreement
} = require('../dist/main/packaging/packagedVersionAgreement');

const desktopRoot = path.join(__dirname, '..');
const pkg = require('../package.json');
let identity = null;
try {
    identity = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'build-identity.json'), 'utf8'));
} catch {
    identity = null;
}

const releaseDir = process.env.NALAMDESK_RELEASE_DIR || path.join(desktopRoot, 'release');
const agreement = readReleaseAgreement(releaseDir, pkg.version, identity, process.platform);
assertPackagedVersionAgreement(agreement);
console.log(`[assert-packaged-version] OK version=${pkg.version} display=${agreement.displayedVersion}`);

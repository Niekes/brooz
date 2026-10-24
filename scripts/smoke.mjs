#!/usr/bin/env node
/**
 * The release smoke test: launches the packaged app from release/ with
 * BROOZ_SMOKE=1. The app checks its own window (tiles, title, isolation,
 * the ask bar summoning a live tile) and exits 0 or 1 - see
 * src/main/smoke.ts. Run it after `npm run package`; on Linux CI wrap it in
 * xvfb-run.
 *
 * Usage: node scripts/smoke.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT = 120_000;

const CANDIDATES = {
    darwin: [
        `release/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/Brooz.app/Contents/MacOS/Brooz`
    ],
    win32: ['release/win-unpacked/Brooz.exe'],
    linux: ['release/linux-unpacked/brooz', 'release/linux-unpacked/Brooz']
};

const binary = (CANDIDATES[process.platform] ?? [])
    .map((candidate) => join(ROOT, candidate))
    .find((candidate) => existsSync(candidate));

if (!binary) {
    console.error(
        `No packaged app for ${process.platform} in release/. Run npm run package first.`
    );
    process.exit(1);
}

console.log(`Smoke testing ${binary}`);
const child = spawn(binary, [], {
    env: { ...process.env, BROOZ_SMOKE: '1' },
    stdio: 'inherit'
});

const timer = setTimeout(() => {
    console.error(`The app did not finish within ${TIMEOUT / 1000} s.`);
    child.kill();
    process.exit(1);
}, TIMEOUT);

child.once('error', (error) => {
    console.error(error.message);
    process.exit(1);
});

child.once('exit', (code) => {
    clearTimeout(timer);
    console.log(code === 0 ? 'The packaged app passed.' : `The packaged app failed (${code}).`);
    process.exit(code === 0 ? 0 : 1);
});

#!/usr/bin/env node
/**
 * The dev loop: build the main and preload bundles once, start the Vite
 * dev server for the renderer, then run Electron against it. Changes in
 * the renderer reach the window through HMR; a change in the main process
 * or the preload needs a restart.
 *
 * Usage: npm run dev
 */

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS = process.platform === 'win32';

const bin = (name) => join(ROOT, 'node_modules', '.bin', WINDOWS ? `${name}.cmd` : name);

const run = (command, args) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd: ROOT, shell: WINDOWS, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code) => {
            if (code === 0) {
                resolve(undefined);
            } else {
                reject(new Error(`${command} exited with code ${code}.`));
            }
        });
    });

/**
 * On macOS the bold app name in the menu bar comes from the bundle that
 * runs, which in dev is Electron's own Electron.app. Rename that bundle to
 * the product name, so dev shows the same name as the packaged app. It
 * lives in node_modules, so this runs on every start: an npm install puts
 * the original back.
 */
function nameDevBundle() {
    const { productName } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const plist = join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/Info.plist');
    for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
        execFileSync('plutil', ['-replace', key, '-string', productName, plist]);
    }
}

if (process.platform === 'darwin') {
    nameDevBundle();
}

// The main and preload bundles do not hot-reload: build them once up front.
await run(bin('vp'), ['pack']);

const devServer = spawn(bin('vp'), ['dev'], {
    cwd: ROOT,
    shell: WINDOWS,
    stdio: ['ignore', 'pipe', 'inherit']
});

const devUrl = await new Promise((resolve, reject) => {
    devServer.stdout.on('data', (chunk) => {
        const match = /Local:\s+(http:\/\/\S+)/.exec(String(chunk));
        if (match) {
            resolve(match[1]);
        }
    });
    devServer.once('exit', (code) => reject(new Error(`The dev server exited with code ${code}.`)));
});

// Forward the request log and the HMR updates of the dev server.
devServer.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
});

const electron = spawn(bin('electron'), ['.'], {
    cwd: ROOT,
    shell: WINDOWS,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: devUrl }
});

await new Promise((resolve) => electron.once('exit', () => resolve(undefined)));

devServer.kill();
process.exit(0);

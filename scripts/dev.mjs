#!/usr/bin/env node
/**
 * The dev loop: build the main and preload bundles once, start the Vite
 * dev server for the renderer, then run Electron against it. Changes in
 * the renderer reach the window through HMR; a change in the main process
 * or the preload needs a restart.
 *
 * Usage: npm run dev
 */

import { spawn } from 'node:child_process';
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

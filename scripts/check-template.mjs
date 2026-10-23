#!/usr/bin/env node
/**
 * Checks the brooz app template.
 *
 * The template is the shape of the app, not just its behaviour:
 *
 *   src/renderer/tiles/<name>/index.tsx  exports `<name>Tile` typed
 *                                       `TileDefinition`
 *   one tile directory                   never imports from another tile
 *   every source file                    `export function` for public
 *                                       functions, no default exports
 *
 * Fallow covers the parts of the template that need a real dependency graph
 * (zones, dead code, test coverage). This script covers the parts that are
 * about naming and shape, which are cheaper to check by reading the source
 * directly - and which keep working without fallow installed.
 *
 * A tile that is missing from the registry falls over fallow's
 * `unused-exports` rule, so it needs no check here.
 *
 * Usage: node scripts/check-template.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const violations = [];
const fail = (message) => violations.push(message);
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

function collectSourceFiles(dir) {
    const files = [];
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(`${dir}/${entry.name}`));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            files.push(`${dir}/${entry.name}`);
        }
    }
    return files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const TILES = 'src/renderer/tiles';

const tileNames = readdirSync(join(ROOT, TILES), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * A tile directory owns exactly one export of type `TileDefinition`, named
 * after the directory: `tiles/about` exports `aboutTile`.
 */
for (const name of tileNames) {
    const file = `${TILES}/${name}/index.tsx`;
    if (!existsSync(join(ROOT, file))) {
        fail(`${TILES}/${name}/: a tile directory must contain index.tsx`);
        continue;
    }
    const source = read(file);

    if (!new RegExp(`export\\s+const\\s+${name}Tile\\s*:\\s*TileDefinition\\b`).test(source)) {
        fail(`${file}: must export '${name}Tile' typed 'TileDefinition'`);
    }

    for (const other of tileNames) {
        if (other === name) {
            continue;
        }
        if (new RegExp(`from\\s+['"]\\.\\./${other}(/[^'"]*)?['"]`).test(source)) {
            fail(`${file}: a tile never imports from another tile ('${other}')`);
        }
    }
}

/**
 * Public functions are declared with `export function`, never with
 * `export const` arrow functions. A named declaration keeps the hoisting
 * and the stack traces predictable. There are no default exports.
 */
for (const file of collectSourceFiles('src')) {
    const source = read(file);

    if (/^export\s+const\s+\w+\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/m.test(source)) {
        fail(`${file}: use 'export function' instead of an 'export const' arrow function`);
    }

    if (/^export\s+default\b/m.test(source)) {
        fail(`${file}: the app has no default exports`);
    }
}

/**
 * The sandboxed preload may import `electron` and nothing else from the
 * package space - no react, no helpers, no accidental Node access through
 * a transitive import. The relative imports of the shared contract are the
 * only allowed exception.
 */
for (const file of collectSourceFiles('src/preload')) {
    const source = read(file);

    for (const [, specifier] of source.matchAll(/from\s+'([^']+)'/g)) {
        if (!specifier.startsWith('.') && specifier !== 'electron') {
            fail(`${file}: the sandboxed preload may only import electron, not '${specifier}'`);
        }
    }
}

if (violations.length > 0) {
    console.error(`${violations.length} app template violation(s):\n`);
    for (const violation of violations) {
        console.error(`  - ${violation}`);
    }
    console.error('');
    process.exit(1);
}

console.log('app template satisfied');

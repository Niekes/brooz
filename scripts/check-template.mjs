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
 *   the shadcn primitives                unchanged since `npm run ui:add`,
 *                                       each reached from an app-* wrapper
 *   the cursor                           follows the element's role
 *                                       (styles.css), never set by hand
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

import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
    PRIMITIVES,
    hashPrimitives,
    nextLock,
    readLock,
    unwrappedPrimitives
} from './primitives-lock.mjs';

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
 * The cursor follows the element's role, from one rule in styles.css: a
 * button points, an input takes text, a disabled control is not allowed.
 * Special cursors (grab, move) stay free.
 */
const HAND_CURSOR =
    /\bcursor-(pointer|text|default|not-allowed)\b|cursor:\s*['"](pointer|text|default|not-allowed)['"]/;
assert.ok(
    HAND_CURSOR.test('disabled:cursor-not-allowed') && HAND_CURSOR.test("{ cursor: 'pointer' }")
);
assert.ok(!HAND_CURSOR.test('cursor-grab active:cursor-grabbing'));

/**
 * Public functions are declared with `export function`, never with
 * `export const` arrow functions. A named declaration keeps the hoisting
 * and the stack traces predictable. There are no default exports.
 */
for (const file of collectSourceFiles('src')) {
    if (file.startsWith(`${PRIMITIVES}/`)) {
        continue;
    }
    const source = read(file);

    if (/^export\s+const\s+\w+\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/m.test(source)) {
        fail(`${file}: use 'export function' instead of an 'export const' arrow function`);
    }

    if (/^export\s+default\b/m.test(source)) {
        fail(`${file}: the app has no default exports`);
    }

    if (HAND_CURSOR.test(source)) {
        fail(
            `${file}: the cursor follows the element's role (src/renderer/styles.css) - do not set pointer, text, default or not-allowed by hand`
        );
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

/**
 * The shadcn primitives stay as generated: their hashes match the lock that
 * `npm run ui:add` wrote. Change them through their app-* wrappers instead
 * (docs/adr/0004).
 */
// Self-check of `ui:add`: without names it never accepts a changed hash.
assert.deepEqual(
    nextLock({ 'a.tsx': 'old', 'gone.tsx': 'x' }, { 'a.tsx': 'new', 'b.tsx': 'b' }, []),
    {
        'a.tsx': 'old'
    }
);
assert.deepEqual(nextLock({ 'a.tsx': 'old' }, { 'a.tsx': 'new', 'b.tsx': 'b' }, ['a']), {
    'a.tsx': 'new',
    'b.tsx': 'b'
});

// Self-check: sub-folders are hashed by their path, and reachability follows
// the alias, relative and nested imports between primitives.
const scratch = mkdtempSync(join(tmpdir(), 'brooz-primitives-'));
mkdirSync(join(scratch, 'sub'));
writeFileSync(join(scratch, 'sub', 'b.tsx'), 'b');
writeFileSync(join(scratch, 'a.tsx'), 'a');
assert.deepEqual(Object.keys(hashPrimitives(scratch)), ['a.tsx', 'sub/b.tsx']);
rmSync(scratch, { recursive: true });
assert.deepEqual(
    unwrappedPrimitives(["import { A } from './primitives/a';"], {
        'a.tsx': 'import { B } from "@/renderer/shell/ui/primitives/b"',
        'b.tsx': "import { C } from './sub/c'",
        'sub/c.tsx': "import { A } from '../a'",
        'lonely.tsx': '',
        'notes.md': ''
    }),
    ['lonely.tsx']
);

const locked = readLock();
const current = hashPrimitives();
for (const name of new Set([...Object.keys(locked), ...Object.keys(current)])) {
    if (locked[name] !== current[name]) {
        fail(
            `${PRIMITIVES}/${name}: primitives are not edited by hand - wrap it in an app-* component, or run \`npm run ui:add -- ${name.replace(/\.tsx$/, '')}\``
        );
    }
}

const wrappers = readdirSync(join(ROOT, 'src/renderer/shell/ui'))
    .filter((name) => /^app-.*\.tsx$/.test(name))
    .map((name) => read(`src/renderer/shell/ui/${name}`));
const sources = Object.fromEntries(
    Object.keys(current).map((name) => [name, read(`${PRIMITIVES}/${name}`)])
);
for (const name of unwrappedPrimitives(wrappers, sources)) {
    fail(
        `${PRIMITIVES}/${name}: no app-* wrapper reaches this primitive - wrap it in an app-* component, or remove it`
    );
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

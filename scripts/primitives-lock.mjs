/**
 * The shadcn primitives stay as generated (docs/adr/0004): their SHA-256
 * hashes are locked in primitives.lock.json. `npm run ui:add` writes the
 * lock, `npm run lint` (scripts/check-template.mjs) fails when a primitive
 * no longer matches it.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PRIMITIVES = 'src/renderer/shell/ui/primitives';
const LOCK = 'src/renderer/shell/ui/primitives.lock.json';

/**
 * The hash of every primitive at any depth, by its path inside `dir`
 * (`button.tsx`, `sub/x.tsx`): shadcn may write a sub-folder.
 */
export function hashPrimitives(dir = join(ROOT, PRIMITIVES)) {
    const hashes = {};
    for (const name of readdirSync(dir, { recursive: true }).sort()) {
        if (statSync(join(dir, name)).isFile()) {
            const source = readFileSync(join(dir, name));
            hashes[name.split(sep).join('/')] = createHash('sha256').update(source).digest('hex');
        }
    }
    return hashes;
}

/** The primitive an import names, seen from `dir` inside the primitives (null: a wrapper). */
function primitiveOf(specifier, dir, names) {
    const path =
        specifier.match(/(?:^|\/)primitives\/(.+)$/)?.[1] ??
        (dir !== null && specifier.startsWith('.') ? posix.join(dir, specifier) : null);
    return names.find((name) => name.replace(/\.tsx?$/, '') === path);
}

/**
 * The primitives no app-* wrapper reaches, directly or through other
 * primitives (shadcn's dialog imports its button). `wrappers` are sources,
 * `primitives` maps each path inside the primitives to its source.
 */
export function unwrappedPrimitives(wrappers, primitives) {
    const names = Object.keys(primitives).filter((name) => /\.tsx?$/.test(name));
    const reached = new Set();
    const visit = (source, dir) => {
        for (const [, specifier] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
            const name = primitiveOf(specifier, dir, names);
            if (name && !reached.has(name)) {
                reached.add(name);
                visit(primitives[name], posix.dirname(name));
            }
        }
    };
    for (const source of wrappers) {
        visit(source, null);
    }
    return names.filter((name) => !reached.has(name));
}

/** The locked hashes, or none before the first lock. */
export function readLock() {
    try {
        return JSON.parse(readFileSync(join(ROOT, LOCK), 'utf8'));
    } catch {
        return {};
    }
}

/**
 * The lock after `shadcn add <names>`: the named components and the files
 * shadcn just created take their new hash, every other primitive keeps its
 * locked one, so a hand edit elsewhere still fails the lint. Without names
 * it only forgets primitives that were deleted.
 */
export function nextLock(locked, current, names) {
    const files = new Set(names.map((name) => `${name}.tsx`));
    const next = {};
    for (const [file, hash] of Object.entries(current)) {
        if (files.has(file) || (files.size > 0 && !(file in locked))) {
            next[file] = hash;
        } else if (file in locked) {
            next[file] = locked[file];
        }
    }
    return next;
}

export function relock(names) {
    const next = nextLock(readLock(), hashPrimitives(), names);
    writeFileSync(join(ROOT, LOCK), `${JSON.stringify(next, null, 4)}\n`);
}

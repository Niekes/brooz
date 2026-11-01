/**
 * The shadcn primitives stay as generated (docs/adr/0004): their SHA-256
 * hashes are locked in primitives.lock.json. `npm run ui:add` writes the
 * lock, `npm run lint` (scripts/check-template.mjs) fails when a primitive
 * no longer matches it.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const PRIMITIVES = 'src/renderer/shell/ui/primitives';
const LOCK = 'src/renderer/shell/ui/primitives.lock.json';

/** The hash of every primitive, by file name. */
export function hashPrimitives() {
    const hashes = {};
    for (const name of readdirSync(join(ROOT, PRIMITIVES)).sort()) {
        const source = readFileSync(join(ROOT, PRIMITIVES, name));
        hashes[name] = createHash('sha256').update(source).digest('hex');
    }
    return hashes;
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

#!/usr/bin/env node
/**
 * Adds or updates shadcn primitives, then locks their hashes: the only way
 * a primitive may change (docs/adr/0004). Without names it only forgets
 * the primitives that were deleted, so it never accepts a hand edit.
 *
 * Usage: npm run ui:add -- dialog button
 */

import { execFileSync } from 'node:child_process';
import { relock } from './primitives-lock.mjs';

const components = process.argv.slice(2);
if (components.length > 0) {
    execFileSync('npx', ['--yes', 'shadcn@4.23.0', 'add', ...components, '--yes', '--overwrite'], {
        stdio: 'inherit'
    });
}
relock(components);
console.log('primitives locked');

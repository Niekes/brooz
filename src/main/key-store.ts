import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';
import { PROVIDERS } from '../shared/providers';
import type { KeySave, ProviderId } from '../shared/providers';

/**
 * The key store of the main process: a provider's key, encrypted by the OS
 * (Keychain, DPAPI, the Linux keyring) and kept as a base64 blob in a file
 * under `userData`. Only the main process reads it, and only on demand.
 *
 * The app fails closed: without `safeStorage` encryption it stores nothing
 * at all and every key reads as missing (`docs/adr/0002-safe-storage-fail-closed.md`).
 */

/** The file the encrypted blobs live in. */
const STORE_FILE = 'provider-keys.json';

const blobs = new Map<ProviderId, string>();
let loaded = false;

function storePath(): string {
    return join(app.getPath('userData'), STORE_FILE);
}

/** Loads the store once per session; a missing or corrupt file starts empty. */
function load(): void {
    if (loaded) {
        return;
    }
    loaded = true;
    let raw: string;
    try {
        raw = readFileSync(storePath(), 'utf8');
    } catch {
        return;
    }
    try {
        const stored = JSON.parse(raw) as Record<string, unknown>;
        for (const { id } of PROVIDERS) {
            if (typeof stored[id] === 'string') {
                blobs.set(id, stored[id]);
            }
        }
    } catch {
        // A corrupt file holds no keys; the next save replaces it.
    }
}

function persist(): void {
    writeFileSync(storePath(), JSON.stringify(Object.fromEntries(blobs)));
}

/** Whether the OS offers encrypted key storage. */
export function canStoreKeys(): boolean {
    return safeStorage.isEncryptionAvailable();
}

/**
 * The decrypted key of a provider, or null: never set, unreadable, or the OS
 * cannot decrypt anything here. No caller outside the main process exists.
 */
export function providerKey(provider: ProviderId): string | null {
    if (!canStoreKeys()) {
        return null;
    }
    load();
    const blob = blobs.get(provider);
    if (blob === undefined) {
        return null;
    }
    try {
        const key = safeStorage.decryptString(Buffer.from(blob, 'base64'));
        return key.length > 0 ? key : null;
    } catch {
        return null;
    }
}

/** Saves a key, or refuses to when this system cannot encrypt it. */
export function saveKey(provider: ProviderId, key: string): KeySave {
    if (!canStoreKeys()) {
        return { status: 'encryption-unavailable' };
    }
    load();
    blobs.set(provider, safeStorage.encryptString(key).toString('base64'));
    persist();
    return { status: 'ok' };
}

/** Deletes a provider's key, whenever it was stored. */
export function deleteKey(provider: ProviderId): void {
    load();
    if (blobs.delete(provider)) {
        persist();
    }
}

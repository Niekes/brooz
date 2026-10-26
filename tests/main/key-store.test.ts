import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

let dir: string;
const isEncryptionAvailable = vi.fn(() => true);
const encryptString = vi.fn((key: string) => Buffer.from(`enc(${key})`, 'utf8'));
const decryptString = vi.fn((blob: Buffer) => {
    const text = blob.toString('utf8');
    if (!text.startsWith('enc(') || !text.endsWith(')')) {
        throw new Error('unreadable blob');
    }
    return text.slice(4, -1);
});

vi.mock('electron', () => ({
    app: { getPath: () => dir },
    safeStorage: {
        isEncryptionAvailable: () => isEncryptionAvailable(),
        encryptString: (key: string) => encryptString(key),
        decryptString: (blob: Buffer) => decryptString(blob)
    }
}));

/** A fresh module of the store, reading the current `dir`. */
async function store(): Promise<typeof import('../../src/main/key-store')> {
    return import('../../src/main/key-store');
}

const file = (): string => join(dir, 'provider-keys.json');
const readStore = (): Record<string, unknown> => JSON.parse(readFileSync(file(), 'utf8'));

describe('the provider key store', () => {
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'brooz-keys-'));
        isEncryptionAvailable.mockReturnValue(true);
        vi.resetModules();
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('has no key before one is saved', async () => {
        const keys = await store();
        expect(keys.providerKey('finnhub')).toBe(null);
    });

    it('saves a key encrypted and reads it back', async () => {
        const keys = await store();
        expect(keys.saveKey('finnhub', 's3cret')).toEqual({ status: 'ok' });
        const stored = readStore();
        expect(stored).toEqual({ finnhub: expect.any(String) });
        expect(JSON.stringify(stored)).not.toContain('s3cret');
        expect(keys.providerKey('finnhub')).toBe('s3cret');
    });

    it('reads a key a previous session stored', async () => {
        (await store()).saveKey('finnhub', 'k1');
        vi.resetModules();
        expect((await store()).providerKey('finnhub')).toBe('k1');
    });

    it('refuses to save when the OS cannot encrypt, and writes nothing', async () => {
        isEncryptionAvailable.mockReturnValue(false);
        const keys = await store();
        expect(keys.saveKey('finnhub', 'k1')).toEqual({ status: 'encryption-unavailable' });
        expect(existsSync(file())).toBe(false);
        expect(encryptString).not.toHaveBeenCalled();
        expect(keys.providerKey('finnhub')).toBe(null);
    });

    it('treats a stored key as missing when the OS cannot decrypt', async () => {
        const keys = await store();
        keys.saveKey('finnhub', 'k1');
        isEncryptionAvailable.mockReturnValue(false);
        expect(keys.providerKey('finnhub')).toBe(null);
    });

    it('survives a corrupt store file', async () => {
        writeFileSync(file(), '{ not json');
        const keys = await store();
        expect(keys.providerKey('finnhub')).toBe(null);
        expect(keys.saveKey('finnhub', 'k2')).toEqual({ status: 'ok' });
        expect(keys.providerKey('finnhub')).toBe('k2');
    });

    it('treats a key that decrypts to nothing as no key', async () => {
        const keys = await store();
        keys.saveKey('finnhub', 'k1');
        decryptString.mockReturnValueOnce('');
        expect(keys.providerKey('finnhub')).toBe(null);
    });

    it('treats an unreadable blob as no key', async () => {
        writeFileSync(
            file(),
            JSON.stringify({ finnhub: Buffer.from('garbage').toString('base64') })
        );
        const keys = await store();
        expect(keys.providerKey('finnhub')).toBe(null);
    });

    it('ignores entries of providers the manifest does not know', async () => {
        writeFileSync(file(), JSON.stringify({ unknown: 'enc(x)' }));
        const keys = await store();
        keys.saveKey('finnhub', 'k1');
        expect(readStore()).toEqual({ finnhub: expect.any(String) });
    });

    it('deletes a key from memory and from the file', async () => {
        const keys = await store();
        keys.saveKey('finnhub', 'k1');
        keys.deleteKey('finnhub');
        expect(keys.providerKey('finnhub')).toBe(null);
        expect(readStore()).toEqual({});
        keys.deleteKey('finnhub');
        expect(readStore()).toEqual({});
    });

    it('deletes a key a previous session stored', async () => {
        (await store()).saveKey('finnhub', 'k1');
        vi.resetModules();
        const keys = await store();
        keys.deleteKey('finnhub');
        expect(keys.providerKey('finnhub')).toBe(null);
        expect(readStore()).toEqual({});
    });

    it('reports whether this system can store keys', async () => {
        isEncryptionAvailable.mockReturnValue(false);
        expect((await store()).canStoreKeys()).toBe(false);
    });
});

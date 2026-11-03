import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

let dir: string;
let encryptCount = 0;
const isAsyncEncryptionAvailable = vi.fn(async () => true);
// A counter in the blob, so a re-encryption is visible as a new blob.
const encryptStringAsync = vi.fn(async (key: string) =>
    Buffer.from(`enc(${key})#${++encryptCount}`, 'utf8')
);
const decryptStringAsync = vi.fn(async (blob: Buffer) => {
    // The optional counter suffix is this suite's; blobs written by the
    // deprecated sync encryptString have none and stay readable.
    const match = /^enc\((.*)\)(?:#\d+)?$/.exec(blob.toString('utf8'));
    if (!match) {
        throw new Error('unreadable blob');
    }
    return { result: match[1], shouldReEncrypt: false };
});

vi.mock('electron', () => ({
    app: { getPath: () => dir },
    safeStorage: {
        isAsyncEncryptionAvailable: () => isAsyncEncryptionAvailable(),
        encryptStringAsync: (key: string) => encryptStringAsync(key),
        decryptStringAsync: (blob: Buffer) => decryptStringAsync(blob)
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
        encryptCount = 0;
        isAsyncEncryptionAvailable.mockResolvedValue(true);
        vi.resetModules();
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('has no key before one is saved', async () => {
        const keys = await store();
        expect(await keys.providerKey('finnhub')).toBe(null);
    });

    it('saves a key encrypted and reads it back', async () => {
        const keys = await store();
        expect(await keys.saveKey('finnhub', 's3cret')).toEqual({ status: 'ok' });
        const stored = readStore();
        expect(stored).toEqual({ finnhub: expect.any(String) });
        expect(JSON.stringify(stored)).not.toContain('s3cret');
        expect(await keys.providerKey('finnhub')).toBe('s3cret');
    });

    it('reads a key a previous session stored', async () => {
        await (await store()).saveKey('finnhub', 'k1');
        vi.resetModules();
        expect(await (await store()).providerKey('finnhub')).toBe('k1');
    });

    it('refuses to save when the OS cannot encrypt, and writes nothing', async () => {
        isAsyncEncryptionAvailable.mockResolvedValue(false);
        const keys = await store();
        expect(await keys.saveKey('finnhub', 'k1')).toEqual({ status: 'encryption-unavailable' });
        expect(existsSync(file())).toBe(false);
        expect(encryptStringAsync).not.toHaveBeenCalled();
        expect(await keys.providerKey('finnhub')).toBe(null);
    });

    it('treats a stored key as missing when the OS cannot decrypt', async () => {
        const keys = await store();
        await keys.saveKey('finnhub', 'k1');
        isAsyncEncryptionAvailable.mockResolvedValue(false);
        expect(await keys.providerKey('finnhub')).toBe(null);
    });

    it('survives a corrupt store file', async () => {
        writeFileSync(file(), '{ not json');
        const keys = await store();
        expect(await keys.providerKey('finnhub')).toBe(null);
        expect(await keys.saveKey('finnhub', 'k2')).toEqual({ status: 'ok' });
        expect(await keys.providerKey('finnhub')).toBe('k2');
    });

    it('treats a key that decrypts to nothing as no key', async () => {
        const keys = await store();
        await keys.saveKey('finnhub', 'k1');
        decryptStringAsync.mockResolvedValueOnce({ result: '', shouldReEncrypt: false });
        expect(await keys.providerKey('finnhub')).toBe(null);
    });

    it('re-encrypts and persists a key when the OS rotated its key', async () => {
        const keys = await store();
        await keys.saveKey('finnhub', 'k1');
        const before = readStore().finnhub;
        const encryptsBefore = encryptStringAsync.mock.calls.length;
        decryptStringAsync.mockResolvedValueOnce({ result: 'k1', shouldReEncrypt: true });
        expect(await keys.providerKey('finnhub')).toBe('k1');
        expect(encryptStringAsync.mock.calls.length).toBe(encryptsBefore + 1);
        expect(readStore().finnhub).not.toBe(before);
    });

    it('reads a blob written by the deprecated sync encryptString', async () => {
        writeFileSync(
            file(),
            JSON.stringify({ finnhub: Buffer.from('enc(k1)').toString('base64') })
        );
        const keys = await store();
        expect(await keys.providerKey('finnhub')).toBe('k1');
    });

    it('treats an unreadable blob as no key', async () => {
        writeFileSync(
            file(),
            JSON.stringify({ finnhub: Buffer.from('garbage').toString('base64') })
        );
        const keys = await store();
        expect(await keys.providerKey('finnhub')).toBe(null);
    });

    it('ignores entries of providers the manifest does not know', async () => {
        writeFileSync(file(), JSON.stringify({ unknown: 'enc(x)' }));
        const keys = await store();
        await keys.saveKey('finnhub', 'k1');
        expect(readStore()).toEqual({ finnhub: expect.any(String) });
    });

    it('deletes a key from memory and from the file', async () => {
        const keys = await store();
        await keys.saveKey('finnhub', 'k1');
        await keys.deleteKey('finnhub');
        expect(await keys.providerKey('finnhub')).toBe(null);
        expect(readStore()).toEqual({});
        await keys.deleteKey('finnhub');
        expect(readStore()).toEqual({});
    });

    it('deletes a key a previous session stored', async () => {
        await (await store()).saveKey('finnhub', 'k1');
        vi.resetModules();
        const keys = await store();
        await keys.deleteKey('finnhub');
        expect(await keys.providerKey('finnhub')).toBe(null);
        expect(readStore()).toEqual({});
    });

    it('reports whether this system can store keys', async () => {
        isAsyncEncryptionAvailable.mockResolvedValue(false);
        expect(await (await store()).canStoreKeys()).toBe(false);
    });
});

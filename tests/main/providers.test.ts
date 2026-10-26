import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const canStoreKeys = vi.fn(() => true);
const providerKey = vi.fn((_provider: string): string | null => 'k1');
const fetchQuotes = vi.fn(async (_key: string, _symbols: string[]) => ({
    status: 'ok',
    data: [{ symbol: 'AAPL', price: 1, changePercent: null }]
}));
const probeKey = vi.fn(async (_key: string) => ({ status: 'ok' }));

vi.mock('electron', () => ({}));
vi.mock('../../src/main/key-store', () => ({
    canStoreKeys: () => canStoreKeys(),
    providerKey: (provider: string) => providerKey(provider)
}));
vi.mock('../../src/main/finnhub', () => ({
    fetchQuotes: (key: string, symbols: string[]) => fetchQuotes(key, symbols),
    probeKey: (key: string) => probeKey(key)
}));

describe('the provider side of the contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        canStoreKeys.mockReturnValue(true);
        providerKey.mockReturnValue('k1');
    });

    it('tells the reason a key is missing', async () => {
        const api = await import('../../src/main/providers');
        expect(api.missingKeyReason()).toBe('not-set');
        canStoreKeys.mockReturnValue(false);
        expect(api.missingKeyReason()).toBe('encryption-unavailable');
    });

    it('quotes symbols with the stored key', async () => {
        const result = await import('../../src/main/providers').then((api) =>
            api.stockQuotes(['AAPL'])
        );
        expect(result).toEqual({
            status: 'ok',
            data: [{ symbol: 'AAPL', price: 1, changePercent: null }]
        });
        expect(fetchQuotes).toHaveBeenCalledWith('k1', ['AAPL']);
    });

    it('answers missing-key when no key was ever set', async () => {
        providerKey.mockReturnValue(null);
        const result = await import('../../src/main/providers').then((api) =>
            api.stockQuotes(['AAPL'])
        );
        expect(result).toEqual({ status: 'missing-key', reason: 'not-set' });
        expect(fetchQuotes).not.toHaveBeenCalled();
    });

    it('answers missing-key with the encryption reason when the OS cannot store keys', async () => {
        canStoreKeys.mockReturnValue(false);
        providerKey.mockReturnValue(null);
        const result = await import('../../src/main/providers').then((api) =>
            api.stockQuotes(['AAPL'])
        );
        expect(result).toEqual({ status: 'missing-key', reason: 'encryption-unavailable' });
    });

    it('probes a provider with the stored key', async () => {
        const result = await import('../../src/main/providers').then((api) =>
            api.probeProvider('finnhub')
        );
        expect(result).toEqual({ status: 'ok' });
        expect(probeKey).toHaveBeenCalledWith('k1');
    });

    it('answers a probe of a missing key with the reason', async () => {
        providerKey.mockReturnValue(null);
        const result = await import('../../src/main/providers').then((api) =>
            api.probeProvider('finnhub')
        );
        expect(result).toEqual({ status: 'missing-key', reason: 'not-set' });
        expect(probeKey).not.toHaveBeenCalled();
    });
});

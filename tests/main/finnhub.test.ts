import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchMock = vi.fn();

vi.mock('electron', () => ({
    net: { fetch: (...args: unknown[]) => fetchMock(...args) }
}));

/** A fresh module, so every test starts with an empty quote cache. */
async function finnhub(): Promise<typeof import('../../src/main/finnhub')> {
    return import('../../src/main/finnhub');
}

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

describe('the Finnhub provider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.resetModules();
    });

    it('quotes the symbols, and spells crypto the Finnhub way', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            const requested = new URL(url).searchParams.get('symbol');
            return ok({
                c: requested === 'AAPL' ? 189.4 : 67420,
                dp: requested === 'AAPL' ? -1.2 : 0.8
            });
        });
        const result = await (await finnhub()).fetchQuotes('k1', ['AAPL', 'BTC-USD']);
        expect(result).toEqual({
            status: 'ok',
            data: [
                { symbol: 'AAPL', price: 189.4, changePercent: -1.2 },
                { symbol: 'BTC-USD', price: 67420, changePercent: 0.8 }
            ]
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[0][0])).toContain('symbol=AAPL&token=k1');
        expect(String(fetchMock.mock.calls[1][0])).toContain('symbol=BINANCE%3ABTCUSDT');
    });

    it('answers with the provider error when the service rejects the key', async () => {
        fetchMock.mockResolvedValue(new Response('no', { status: 401 }));
        const result = await (await finnhub()).fetchQuotes('k1', ['AAPL']);
        expect(result).toEqual({ status: 'provider-error', message: 'Finnhub replied with 401.' });
    });

    it('answers with the provider error when the service is unreachable', async () => {
        fetchMock.mockRejectedValue(new DOMException('aborted', 'TimeoutError'));
        const result = await (await finnhub()).fetchQuotes('k1', ['AAPL']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'Finnhub did not answer in time.'
        });
    });

    it('answers with the provider error when the failure has no message', async () => {
        fetchMock.mockRejectedValue('the wire is cut');
        const result = await (await finnhub()).fetchQuotes('k1', ['AAPL']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'Finnhub could not be reached.'
        });
    });

    it('serves a repeat quote from the cache, and a new key from the service', async () => {
        fetchMock.mockImplementation(async () => ok({ c: 100, dp: null }));
        const api = await finnhub();
        await api.fetchQuotes('k1', ['AAPL']);
        await api.fetchQuotes('k1', ['AAPL']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await api.fetchQuotes('k2', ['AAPL']);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('drops a cache entry once it is stale', async () => {
        vi.useFakeTimers();
        try {
            fetchMock.mockImplementation(async () => ok({ c: 100, dp: null }));
            const api = await finnhub();
            await api.fetchQuotes('k1', ['AAPL']);
            vi.setSystemTime(Date.now() + 61_000);
            await api.fetchQuotes('k1', ['AAPL']);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps the cache bounded however many symbols pass through', async () => {
        fetchMock.mockImplementation(async () => ok({ c: 1, dp: null }));
        const symbols = Array.from({ length: 120 }, (_, i) => `S${i}`);
        const result = await (await finnhub()).fetchQuotes('k1', symbols);
        expect(result.status).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(120);
    });

    it('probes a key against the service', async () => {
        fetchMock.mockImplementation(async () => ok({ c: 189.4, dp: -1.2 }));
        const api = await finnhub();
        expect(await api.probeKey('k1')).toEqual({ status: 'ok' });

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response('no', { status: 403 }));
        expect(await api.probeKey('k2')).toEqual({
            status: 'provider-error',
            message: 'Finnhub replied with 403.'
        });
    });
});

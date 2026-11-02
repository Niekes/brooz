import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const canStoreKeys = vi.fn(() => true);
const providerKey = vi.fn((_provider: string): string | null => 'k1');
const fetchQuotes = vi.fn(async (_key: string, _symbols: string[]) => ({
    status: 'ok',
    data: [{ symbol: 'AAPL', price: 1, changePercent: null }]
}));
const probeKey = vi.fn(async (_key: string) => ({ status: 'ok' }));
const fetchWeather = vi.fn(async (_key: string, _query: unknown) => ({ status: 'ok', data: 'w' }));
const fetchAirQuality = vi.fn(async (_key: string, _query: unknown) => ({
    status: 'ok',
    data: 'a'
}));
const probeWeatherKey = vi.fn(async (_key: string) => ({ status: 'ok' }));
const fetchSurf = vi.fn(async (_key: string, _spot: unknown) => ({ status: 'ok', data: 's' }));
const probeSurfKey = vi.fn(async (_key: string) => ({ status: 'ok' }));

vi.mock('electron', () => ({}));
vi.mock('../../src/main/key-store', () => ({
    canStoreKeys: () => canStoreKeys(),
    providerKey: (provider: string) => providerKey(provider)
}));
vi.mock('../../src/main/finnhub', () => ({
    fetchQuotes: (key: string, symbols: string[]) => fetchQuotes(key, symbols),
    probeKey: (key: string) => probeKey(key)
}));
vi.mock('../../src/main/openweathermap', () => ({
    fetchWeather: (key: string, query: unknown) => fetchWeather(key, query),
    fetchAirQuality: (key: string, query: unknown) => fetchAirQuality(key, query),
    probeKey: (key: string) => probeWeatherKey(key)
}));
vi.mock('../../src/main/stormglass', () => ({
    fetchSurf: (key: string, spot: unknown) => fetchSurf(key, spot),
    probeKey: (key: string) => probeSurfKey(key)
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

    it('fetches the weather and the air quality with the OpenWeatherMap key', async () => {
        const api = await import('../../src/main/providers');
        await expect(api.weather({ city: 'Oslo' })).resolves.toEqual({ status: 'ok', data: 'w' });
        await expect(api.airQuality({ city: 'Oslo' })).resolves.toEqual({
            status: 'ok',
            data: 'a'
        });
        expect(providerKey).toHaveBeenCalledWith('openweathermap');
        expect(fetchWeather).toHaveBeenCalledWith('k1', { city: 'Oslo' });
        expect(fetchAirQuality).toHaveBeenCalledWith('k1', { city: 'Oslo' });
    });

    it('answers missing-key for the weather without a key', async () => {
        providerKey.mockReturnValue(null);
        const api = await import('../../src/main/providers');
        await expect(api.weather({ city: 'Oslo' })).resolves.toEqual({
            status: 'missing-key',
            reason: 'not-set'
        });
        expect(fetchWeather).not.toHaveBeenCalled();
    });

    it('probes each provider with its own service', async () => {
        const api = await import('../../src/main/providers');
        await api.probeProvider('openweathermap');
        expect(probeWeatherKey).toHaveBeenCalledWith('k1');
        await api.probeProvider('stormglass');
        expect(probeSurfKey).toHaveBeenCalledWith('k1');
        expect(probeKey).not.toHaveBeenCalled();
    });

    it('fetches the surf forecast with the Stormglass key', async () => {
        const api = await import('../../src/main/providers');
        const spot = { latitude: 38.99, longitude: -9.42 };
        await expect(api.surf(spot)).resolves.toEqual({ status: 'ok', data: 's' });
        expect(providerKey).toHaveBeenCalledWith('stormglass');
        expect(fetchSurf).toHaveBeenCalledWith('k1', spot);
    });
});

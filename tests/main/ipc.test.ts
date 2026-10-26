import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { registerIpcHandlers } from '../../src/main/ipc';

const mockHandle = vi.fn();
const mockGetVersion = vi.fn(() => '0.1.0');
const mockGeocode = vi.fn();
const mockWeather = vi.fn();
const mockAirQuality = vi.fn();
const mockSaveKey = vi.fn();
const mockDeleteKey = vi.fn();
const mockProviderKey = vi.fn((_provider: unknown): string | null => null);
const mockCanStoreKeys = vi.fn(() => true);
const mockProbeProvider = vi.fn();
const mockStockQuotes = vi.fn();

vi.mock('electron', () => ({
    app: {
        getVersion: () => mockGetVersion()
    },
    ipcMain: {
        handle: (...args: unknown[]) => mockHandle(...args)
    }
}));

vi.mock('../../src/main/open-meteo', () => ({
    geocodeCity: (...args: unknown[]) => mockGeocode(...args),
    fetchWeather: (...args: unknown[]) => mockWeather(...args),
    fetchAirQuality: (...args: unknown[]) => mockAirQuality(...args)
}));

vi.mock('../../src/main/key-store', () => ({
    saveKey: (...args: unknown[]) => mockSaveKey(...args),
    deleteKey: (...args: unknown[]) => mockDeleteKey(...args),
    providerKey: (provider: unknown) => mockProviderKey(provider),
    canStoreKeys: () => mockCanStoreKeys()
}));

vi.mock('../../src/main/providers', () => ({
    probeProvider: (...args: unknown[]) => mockProbeProvider(...args),
    stockQuotes: (...args: unknown[]) => mockStockQuotes(...args)
}));

type Handler = (event: { senderFrame: { url: string } | null }, ...args: unknown[]) => unknown;

function handlerFor(channel: string): Handler {
    const calls = mockHandle.mock.calls as unknown as [string, Handler][];
    const call = calls.find(([name]) => name === channel);
    expect(call).toBeDefined();
    return call![1];
}

const sender = (url: string) => ({ senderFrame: { url } });
const app = sender('app://app/index.html');

describe('the IPC handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers every channel of the contract', () => {
        registerIpcHandlers();
        expect(mockHandle.mock.calls.map(([channel]) => channel)).toEqual([
            'brooz:app-version',
            'brooz:geocode',
            'brooz:weather',
            'brooz:air-quality',
            'brooz:key-set',
            'brooz:key-delete',
            'brooz:key-status',
            'brooz:key-test',
            'brooz:stock-quotes'
        ]);
    });

    it('answers the app version for an app:// sender', () => {
        registerIpcHandlers();
        expect(handlerFor('brooz:app-version')(app)).toBe('0.1.0');
    });

    it('answers the dev server while it is running', () => {
        registerIpcHandlers('http://localhost:5173/');
        expect(handlerFor('brooz:app-version')(sender('http://localhost:5173/'))).toBe('0.1.0');
    });

    it('rejects a sender without a frame', () => {
        registerIpcHandlers('http://localhost:5173/');
        expect(() => handlerFor('brooz:app-version')({ senderFrame: null })).toThrow(
            /Rejected IPC call from $/
        );
    });

    it.each([
        'brooz:app-version',
        'brooz:geocode',
        'brooz:weather',
        'brooz:air-quality',
        'brooz:key-set',
        'brooz:key-delete',
        'brooz:key-status',
        'brooz:key-test',
        'brooz:stock-quotes'
    ])('rejects any other sender on %s', (channel) => {
        registerIpcHandlers('http://localhost:5173/');
        expect(() => handlerFor(channel)(sender('https://example.com'), { city: 'Rome' })).toThrow(
            /Rejected IPC call from https:\/\/example\.com/
        );
        expect(mockGeocode).not.toHaveBeenCalled();
        expect(mockWeather).not.toHaveBeenCalled();
        expect(mockAirQuality).not.toHaveBeenCalled();
        expect(mockSaveKey).not.toHaveBeenCalled();
        expect(mockDeleteKey).not.toHaveBeenCalled();
        expect(mockProbeProvider).not.toHaveBeenCalled();
        expect(mockStockQuotes).not.toHaveBeenCalled();
    });

    it('geocodes a trimmed city', () => {
        mockGeocode.mockReturnValue('place');
        registerIpcHandlers();
        expect(handlerFor('brooz:geocode')(app, '  Rome ')).toBe('place');
        expect(mockGeocode).toHaveBeenCalledWith('Rome');
    });

    it('fetches the weather for a city or for coordinates', () => {
        mockWeather.mockReturnValue('weather');
        registerIpcHandlers();
        const weather = handlerFor('brooz:weather');
        expect(weather(app, { city: 'Oslo' })).toBe('weather');
        expect(mockWeather).toHaveBeenLastCalledWith({ city: 'Oslo' });
        weather(app, { latitude: -90, longitude: 180 });
        expect(mockWeather).toHaveBeenLastCalledWith({ latitude: -90, longitude: 180 });
    });

    it('fetches the air quality for a place', () => {
        mockAirQuality.mockReturnValue('air');
        registerIpcHandlers();
        expect(handlerFor('brooz:air-quality')(app, { latitude: 52.5, longitude: 13.4 })).toBe(
            'air'
        );
        expect(mockAirQuality).toHaveBeenCalledWith({ latitude: 52.5, longitude: 13.4 });
    });

    it('saves a validated key of a provider of the manifest', () => {
        mockSaveKey.mockReturnValue({ status: 'ok' });
        registerIpcHandlers();
        expect(handlerFor('brooz:key-set')(app, 'finnhub', '  k1 ')).toEqual({ status: 'ok' });
        expect(mockSaveKey).toHaveBeenCalledWith('finnhub', 'k1');
    });

    it('deletes a key of a provider of the manifest', () => {
        registerIpcHandlers();
        handlerFor('brooz:key-delete')(app, 'finnhub');
        expect(mockDeleteKey).toHaveBeenCalledWith('finnhub');
    });

    it('reports a key status, never the key', () => {
        registerIpcHandlers();
        expect(handlerFor('brooz:key-status')(app, 'finnhub')).toEqual({
            present: false,
            canStore: true
        });
        mockProviderKey.mockReturnValue('k1');
        expect(handlerFor('brooz:key-status')(app, 'finnhub')).toEqual({
            present: true,
            canStore: true
        });
    });

    it('probes a provider', async () => {
        mockProbeProvider.mockResolvedValue({ status: 'ok' });
        registerIpcHandlers();
        await expect(handlerFor('brooz:key-test')(app, 'finnhub')).resolves.toEqual({
            status: 'ok'
        });
        expect(mockProbeProvider).toHaveBeenCalledWith('finnhub');
    });

    it('quotes symbols through the provider side', async () => {
        mockStockQuotes.mockResolvedValue({ status: 'ok', data: [] });
        registerIpcHandlers();
        const quotes = handlerFor('brooz:stock-quotes')(app, ['aapl', 'AAPL']);
        await expect(quotes).resolves.toEqual({ status: 'ok', data: [] });
        expect(mockStockQuotes).toHaveBeenCalledWith(['AAPL']);
    });

    it('validates the arguments before anything reaches the network', () => {
        registerIpcHandlers();
        expect(() => handlerFor('brooz:geocode')(app, 42)).toThrow(/must be a string/);
        expect(() => handlerFor('brooz:weather')(app, null)).toThrow(/city or coordinates/);
        expect(() => handlerFor('brooz:air-quality')(app, { latitude: 91, longitude: 0 })).toThrow(
            /out of range/
        );
        expect(() => handlerFor('brooz:key-set')(app, 'unknown', 'k1')).toThrow(/Unknown provider/);
        expect(() => handlerFor('brooz:key-set')(app, 'finnhub', '  ')).toThrow(
            /1 to 256 characters/
        );
        expect(() => handlerFor('brooz:key-delete')(app, 42)).toThrow(/Unknown provider/);
        expect(() => handlerFor('brooz:key-status')(app, 'unknown')).toThrow(/Unknown provider/);
        expect(() => handlerFor('brooz:key-test')(app, 'unknown')).toThrow(/Unknown provider/);
        expect(() => handlerFor('brooz:stock-quotes')(app, 'AAPL')).toThrow(/a list of/);
        expect(() => handlerFor('brooz:stock-quotes')(app, ['ok!'])).toThrow(/at most 12/);
        expect(mockGeocode).not.toHaveBeenCalled();
        expect(mockWeather).not.toHaveBeenCalled();
        expect(mockAirQuality).not.toHaveBeenCalled();
        expect(mockSaveKey).not.toHaveBeenCalled();
        expect(mockDeleteKey).not.toHaveBeenCalled();
        expect(mockProbeProvider).not.toHaveBeenCalled();
        expect(mockStockQuotes).not.toHaveBeenCalled();
    });
});

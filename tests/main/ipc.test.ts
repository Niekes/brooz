import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { registerIpcHandlers } from '../../src/main/ipc';

const mockHandle = vi.fn();
const mockGetVersion = vi.fn(() => '0.1.0');
const mockGeocode = vi.fn();
const mockWeather = vi.fn();
const mockAirQuality = vi.fn();

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
            'brooz:air-quality'
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

    it.each(['brooz:app-version', 'brooz:geocode', 'brooz:weather', 'brooz:air-quality'])(
        'rejects any other sender on %s',
        (channel) => {
            registerIpcHandlers('http://localhost:5173/');
            expect(() =>
                handlerFor(channel)(sender('https://example.com'), { city: 'Rome' })
            ).toThrow(/Rejected IPC call from https:\/\/example\.com/);
            expect(mockGeocode).not.toHaveBeenCalled();
            expect(mockWeather).not.toHaveBeenCalled();
            expect(mockAirQuality).not.toHaveBeenCalled();
        }
    );

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

    it.each([
        ['a number', 42, /must be a string/],
        ['an empty string', '   ', /1 to 100 characters/],
        ['a long string', 'x'.repeat(101), /1 to 100 characters/]
    ])('refuses %s as a city', (_name, city, error) => {
        registerIpcHandlers();
        expect(() => handlerFor('brooz:geocode')(app, city)).toThrow(error);
        expect(() => handlerFor('brooz:weather')(app, { city })).toThrow(error);
        expect(mockGeocode).not.toHaveBeenCalled();
        expect(mockWeather).not.toHaveBeenCalled();
    });

    it.each([
        ['nothing', undefined, /city or coordinates/],
        ['null', null, /city or coordinates/],
        ['a string', 'Rome', /city or coordinates/],
        ['missing coordinates', {}, /out of range/],
        ['a latitude past the pole', { latitude: 90.5, longitude: 0 }, /out of range/],
        ['a longitude past the date line', { latitude: 0, longitude: -181 }, /out of range/],
        ['a non-finite coordinate', { latitude: NaN, longitude: 0 }, /out of range/],
        ['string coordinates', { latitude: '1', longitude: '2' }, /out of range/]
    ])('refuses %s as a place', (_name, place, error) => {
        registerIpcHandlers();
        expect(() => handlerFor('brooz:air-quality')(app, place)).toThrow(error);
        expect(mockAirQuality).not.toHaveBeenCalled();
    });
});

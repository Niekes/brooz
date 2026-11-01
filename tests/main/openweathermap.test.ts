import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchAirQuality, fetchWeather, probeKey } from '../../src/main/openweathermap';

const mockFetch = vi.fn();

vi.mock('electron', () => ({
    net: {
        fetch: (...args: unknown[]) => mockFetch(...args)
    }
}));

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

/** 2026-10-24 18:15 in Madrid (CEST). */
const OBSERVED = 1792858500;
const HOUR = 3600;

function current(id = 803, icon = '04d') {
    return {
        dt: OBSERVED,
        weather: [{ id, icon }],
        main: { temp: 14.2, feels_like: 12.8, humidity: 71.6 },
        wind: { speed: 2.6 }
    };
}

function step(dt: number, id: number, min: number, max: number, pop: number) {
    return { dt, weather: [{ id, icon: '01d' }], main: { temp_min: min, temp_max: max }, pop };
}

/** Six local days in 3-hour steps; the second begins at midnight Madrid time. */
const forecast = {
    list: [
        step(OBSERVED, 803, 9, 16, 0.1),
        step(OBSERVED + 5.75 * HOUR, 500, 8, 12, 0.5),
        step(OBSERVED + 16.75 * HOUR, 800, 10, 13, 0.8),
        step(OBSERVED + 43.75 * HOUR, 800, 7, 11, 0),
        step(OBSERVED + 67.75 * HOUR, 800, 7, 11, 0),
        step(OBSERVED + 91.75 * HOUR, 800, 7, 11, 0),
        step(OBSERVED + 115.75 * HOUR, 800, 7, 11, 0)
    ]
};

const air = {
    list: [{ dt: OBSERVED, main: { aqi: 2 }, components: { pm2_5: 8.26, pm10: 12.04 } }]
};

/** Answers every service by its path; the geocoder places every city in Madrid. */
function serve(answers: Record<string, () => Response>): void {
    mockFetch.mockImplementation((url: string) => {
        const { pathname, searchParams } = new URL(url);
        if (pathname === '/v1/search') {
            return Promise.resolve(
                json({
                    results: [
                        {
                            name: searchParams.get('name'),
                            latitude: 40.4,
                            longitude: -3.7,
                            timezone: 'Europe/Madrid'
                        }
                    ]
                })
            );
        }
        return Promise.resolve(answers[pathname.split('/').pop()!]());
    });
}

/** The URL of the call to one OpenWeatherMap endpoint. */
function called(path: string): URL {
    const urls = mockFetch.mock.calls.map(([url]) => new URL(url as string));
    return urls.find((url) => url.pathname === `/data/2.5/${path}`)!;
}

describe('OpenWeatherMap', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('maps the weather of a city onto the shared contract', async () => {
        serve({ weather: () => json(current()), forecast: () => json(forecast) });
        await expect(fetchWeather('k3y', { city: 'Madrid' })).resolves.toEqual({
            status: 'ok',
            data: {
                place: expect.objectContaining({ name: 'Madrid' }),
                temperatureC: 14.2,
                apparentC: 12.8,
                humidity: 72,
                windKmh: 9.4,
                code: 3,
                isDay: true,
                observedAt: '18:15',
                timezoneAbbreviation: 'CEST',
                daily: [
                    {
                        date: '2026-10-24',
                        code: 3,
                        minC: 9,
                        maxC: 16,
                        precipitationProbability: 10
                    },
                    {
                        date: '2026-10-25',
                        code: 61,
                        minC: 8,
                        maxC: 13,
                        precipitationProbability: 80
                    },
                    { date: '2026-10-26', code: 0, minC: 7, maxC: 11, precipitationProbability: 0 },
                    { date: '2026-10-27', code: 0, minC: 7, maxC: 11, precipitationProbability: 0 },
                    { date: '2026-10-28', code: 0, minC: 7, maxC: 11, precipitationProbability: 0 }
                ]
            }
        });
        const url = called('weather');
        expect(url.origin).toBe('https://api.openweathermap.org');
        expect(url.searchParams.get('lat')).toBe('40.4');
        expect(url.searchParams.get('lon')).toBe('-3.7');
        expect(url.searchParams.get('units')).toBe('metric');
        expect(url.searchParams.get('appid')).toBe('k3y');
        expect(called('forecast').searchParams.get('appid')).toBe('k3y');
    });

    it.each([
        [211, 95],
        [301, 51],
        [501, 61],
        [521, 80],
        [601, 71],
        [621, 85],
        [741, 45],
        [800, 0],
        [801, 1],
        [802, 2],
        [804, 3]
    ])('reads condition %i as WMO code %i', async (id, code) => {
        serve({ weather: () => json(current(id)), forecast: () => json({ list: [] }) });
        const result = await fetchWeather('k3y', { city: `Code ${id}` });
        expect(result).toMatchObject({ status: 'ok', data: { code } });
    });

    it('keeps today as the first day late in the evening, from the current reading', async () => {
        // 23:30 in Madrid: the first forecast step is already tomorrow.
        const late = OBSERVED + 5.25 * HOUR;
        serve({
            weather: () => json({ ...current(800, '01n'), dt: late }),
            forecast: () => json({ list: [step(late + 2.5 * HOUR, 500, 8, 12, 0.5)] })
        });
        const result = await fetchWeather('k3y', { city: 'Late' });
        expect(result).toMatchObject({
            status: 'ok',
            data: {
                daily: [
                    { date: '2026-10-24', code: 0, minC: 14.2, maxC: 14.2 },
                    { date: '2026-10-25', code: 61, minC: 8, maxC: 12 }
                ]
            }
        });
    });

    it('reads a night icon as night', async () => {
        serve({ weather: () => json(current(800, '01n')), forecast: () => json(forecast) });
        const result = await fetchWeather('k3y', { city: 'Night' });
        expect(result).toMatchObject({ status: 'ok', data: { isDay: false } });
    });

    it('caches the weather of a place', async () => {
        serve({ weather: () => json(current()), forecast: () => json(forecast) });
        await fetchWeather('k3y', { city: 'Cached' });
        await fetchWeather('k3y', { city: ' cached ' });
        expect(called('weather')).toBeDefined();
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('explains a rejected key with the activation delay of a new one', async () => {
        serve({ weather: () => json({}, 401), forecast: () => json({}, 401) });
        await expect(fetchWeather('n3w', { city: 'Fresh' })).resolves.toEqual({
            status: 'provider-error',
            message:
                "OpenWeatherMap doesn't accept this key yet. New keys can take up to two hours to activate."
        });
    });

    it('reports any other failing status', async () => {
        serve({ weather: () => json({}, 500), forecast: () => json(forecast) });
        await expect(fetchWeather('k3y', { city: 'Broken' })).resolves.toEqual({
            status: 'provider-error',
            message: 'OpenWeatherMap replied with 500.'
        });
    });

    it('words a failure that is not an error', async () => {
        mockFetch.mockRejectedValue('offline');
        await expect(fetchWeather('k3y', { latitude: 1.5, longitude: 2.5 })).resolves.toEqual({
            status: 'provider-error',
            message: 'OpenWeatherMap could not be reached.'
        });
    });

    it('fetches the air quality of a place, and caches it', async () => {
        serve({ air_pollution: () => json(air) });
        const expected = {
            status: 'ok',
            data: {
                place: expect.objectContaining({ name: 'Seville' }),
                aqi: 2,
                pm25: 8.3,
                pm10: 12,
                observedAt: '18:15'
            }
        };
        await expect(fetchAirQuality('k3y', { city: 'Seville' })).resolves.toEqual(expected);
        await expect(fetchAirQuality('k3y', { city: 'Seville' })).resolves.toEqual(expected);
        expect(called('air_pollution').searchParams.get('appid')).toBe('k3y');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('keeps the index within its five bands', async () => {
        serve({ air_pollution: () => json({ list: [{ ...air.list[0], main: { aqi: 9 } }] }) });
        const result = await fetchAirQuality('k3y', { city: 'Smog' });
        expect(result).toMatchObject({ status: 'ok', data: { aqi: 5 } });
    });

    it('probes a key with the weather of one place', async () => {
        serve({ weather: () => json(current()) });
        await expect(probeKey('k3y')).resolves.toEqual({ status: 'ok' });
        expect(called('weather').searchParams.get('lat')).toBe('52.52');
    });

    it('answers a probe of a rejected key with the reason', async () => {
        serve({ weather: () => json({}, 401) });
        await expect(probeKey('n3w')).resolves.toMatchObject({ status: 'provider-error' });
    });
});

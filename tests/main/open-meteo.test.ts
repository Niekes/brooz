import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchAirQuality, fetchWeather, geocodeCity } from '../../src/main/open-meteo';

const mockFetch = vi.fn();

vi.mock('electron', () => ({
    net: {
        fetch: (...args: unknown[]) => mockFetch(...args)
    }
}));

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

/** The URL of the n-th fetch, parsed. */
function fetched(n: number): URL {
    return new URL(mockFetch.mock.calls[n][0] as string);
}

const geocode = (name: string, extra: Record<string, unknown> = {}) => ({
    results: [{ name, latitude: 41.9, longitude: 12.5, ...extra }]
});

const forecast = {
    timezone_abbreviation: 'CET',
    current: {
        time: '2026-10-24T18:15',
        temperature_2m: 14.2,
        apparent_temperature: 12.8,
        relative_humidity_2m: 71.6,
        weather_code: 3,
        wind_speed_10m: 9.4,
        is_day: 1
    },
    daily: {
        time: ['2026-10-24', '2026-10-25'],
        weather_code: [3, 61],
        temperature_2m_max: [16, 13],
        temperature_2m_min: [9, 8],
        precipitation_probability_max: [10, 80]
    }
};

const air = {
    current: { time: '2026-10-24T18:00', european_aqi: 31.6, pm2_5: 8.26, pm10: 12.04 }
};

describe('Open-Meteo', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('geocodes a city into a place', async () => {
        mockFetch.mockResolvedValue(
            json(
                geocode('Rome', {
                    country: 'Italy',
                    country_code: 'IT',
                    admin1: 'Lazio',
                    timezone: 'Europe/Rome'
                })
            )
        );
        await expect(geocodeCity(' Rome ')).resolves.toEqual({
            name: 'Rome',
            country: 'Italy',
            countryCode: 'IT',
            admin1: 'Lazio',
            latitude: 41.9,
            longitude: 12.5,
            timezone: 'Europe/Rome'
        });
        const url = fetched(0);
        expect(url.origin + url.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search');
        expect(url.searchParams.get('name')).toBe('Rome');
        expect(url.searchParams.get('count')).toBe('1');
    });

    it('caches a geocoded city, ignoring case and spaces', async () => {
        mockFetch.mockResolvedValue(json(geocode('Lyon')));
        await geocodeCity('Lyon');
        await geocodeCity(' lyon');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refetches a city once the cache entry is too old', async () => {
        vi.useFakeTimers();
        mockFetch.mockImplementation(() => Promise.resolve(json(geocode('Porto'))));
        await geocodeCity('Porto');
        vi.advanceTimersByTime(1000 * 60 * 60 + 1);
        await geocodeCity('Porto');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to UTC for a place without a time zone', async () => {
        mockFetch.mockResolvedValue(json(geocode('Nowhere')));
        await expect(geocodeCity('Nowhere')).resolves.toMatchObject({ timezone: 'UTC' });
    });

    it('says so when a city cannot be found', async () => {
        mockFetch.mockResolvedValue(json({}));
        await expect(geocodeCity('Atlantis ')).rejects.toThrow(
            "I couldn't find “Atlantis”. Try another city."
        );
    });

    it('reports a failing service', async () => {
        mockFetch.mockResolvedValue(json({}, 503));
        await expect(geocodeCity('Faro')).rejects.toThrow('The weather service replied with 503.');
    });

    it('fetches the weather of a city', async () => {
        mockFetch
            .mockResolvedValueOnce(json(geocode('Madrid', { timezone: 'Europe/Madrid' })))
            .mockResolvedValueOnce(json(forecast));
        const weather = await fetchWeather({ city: 'Madrid' });
        expect(weather).toEqual({
            place: expect.objectContaining({ name: 'Madrid' }),
            temperatureC: 14.2,
            apparentC: 12.8,
            humidity: 72,
            windKmh: 9.4,
            code: 3,
            isDay: true,
            observedAt: '18:15',
            timezoneAbbreviation: 'CET',
            daily: [
                { date: '2026-10-24', code: 3, minC: 9, maxC: 16, precipitationProbability: 10 },
                { date: '2026-10-25', code: 61, minC: 8, maxC: 13, precipitationProbability: 80 }
            ]
        });
        const url = fetched(1);
        expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
        expect(url.searchParams.get('latitude')).toBe('41.9');
        expect(url.searchParams.get('forecast_days')).toBe('5');
        expect(url.searchParams.get('timezone')).toBe('auto');
    });

    it('fetches the weather of coordinates without geocoding', async () => {
        mockFetch.mockResolvedValue(
            json({
                ...forecast,
                current: { ...forecast.current, is_day: 0 },
                daily: { ...forecast.daily, precipitation_probability_max: undefined }
            })
        );
        const weather = await fetchWeather({ latitude: 1.5, longitude: 2.5 });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(weather.place).toMatchObject({ name: 'Your location', latitude: 1.5 });
        expect(weather.place.timezone).toBeTruthy();
        expect(weather.isDay).toBe(false);
        expect(weather.daily[0].precipitationProbability).toBe(0);
    });

    it('falls back to UTC when the device has no time zone', async () => {
        const resolved = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
            .mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions);
        mockFetch.mockResolvedValue(json(forecast));
        const weather = await fetchWeather({ latitude: 3.5, longitude: 4.5 });
        expect(weather.place.timezone).toBe('UTC');
        resolved.mockRestore();
    });

    it('caches the weather of a place', async () => {
        mockFetch.mockResolvedValue(json(forecast));
        await fetchWeather({ latitude: 5.5, longitude: 6.5 });
        await fetchWeather({ latitude: 5.5004, longitude: 6.5 });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('fetches the air quality of a place', async () => {
        mockFetch.mockResolvedValue(json(air));
        await expect(fetchAirQuality({ latitude: 7.5, longitude: 8.5 })).resolves.toEqual({
            place: expect.objectContaining({ name: 'Your location' }),
            aqi: 32,
            pm25: 8.3,
            pm10: 12,
            observedAt: '18:00'
        });
        const url = fetched(0);
        expect(url.origin + url.pathname).toBe(
            'https://air-quality-api.open-meteo.com/v1/air-quality'
        );
        expect(url.searchParams.get('current')).toBe('european_aqi,pm2_5,pm10');
    });

    it('reads missing air readings as zero, and caches them', async () => {
        mockFetch.mockResolvedValue(
            json({
                current: { time: '2026-10-24T18:00', european_aqi: null, pm2_5: null, pm10: null }
            })
        );
        const reading = await fetchAirQuality({ latitude: 9.5, longitude: 10.5 });
        expect(reading).toMatchObject({ aqi: 0, pm25: 0, pm10: 0 });
        await fetchAirQuality({ latitude: 9.5, longitude: 10.5 });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

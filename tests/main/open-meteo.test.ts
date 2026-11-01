import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { geocodeCity, resolvePlace } from '../../src/main/open-meteo';

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
        await expect(geocodeCity('Faro')).rejects.toThrow('The place search replied with 503.');
    });

    it('resolves coordinates to the device location without geocoding', async () => {
        const place = await resolvePlace({ latitude: 1.5, longitude: 2.5 });
        expect(mockFetch).not.toHaveBeenCalled();
        expect(place).toMatchObject({ name: 'Your location', latitude: 1.5, longitude: 2.5 });
        expect(place.timezone).toBeTruthy();
    });

    it('resolves a city through the geocoder', async () => {
        mockFetch.mockResolvedValue(json(geocode('Bari', { timezone: 'Europe/Rome' })));
        await expect(resolvePlace({ city: 'Bari' })).resolves.toMatchObject({
            name: 'Bari',
            timezone: 'Europe/Rome'
        });
    });

    it('falls back to UTC when the device has no time zone', async () => {
        const resolved = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
            .mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions);
        await expect(resolvePlace({ latitude: 3.5, longitude: 4.5 })).resolves.toMatchObject({
            timezone: 'UTC'
        });
        resolved.mockRestore();
    });

    it('gives up on a request after ten seconds', async () => {
        mockFetch.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
        await expect(geocodeCity('Slowtown')).rejects.toThrow(
            'The place search did not answer in time.'
        );
        const [, options] = mockFetch.mock.calls[0] as [string, { signal: AbortSignal }];
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('passes any other network failure on', async () => {
        mockFetch.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));
        await expect(geocodeCity('Offline')).rejects.toThrow('net::ERR_INTERNET_DISCONNECTED');
    });

    it('keeps at most a hundred places, dropping the oldest first', async () => {
        mockFetch.mockImplementation((url: string) =>
            Promise.resolve(json(geocode(new URL(url).searchParams.get('name')!)))
        );
        for (let i = 0; i < 101; i++) {
            await geocodeCity(`Bounded ${i}`);
        }
        mockFetch.mockClear();
        await geocodeCity('Bounded 100');
        expect(mockFetch).not.toHaveBeenCalled();
        await geocodeCity('Bounded 0');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('drops expired places when it stores a new one', async () => {
        vi.useFakeTimers();
        mockFetch.mockImplementation((url: string) =>
            Promise.resolve(json(geocode(new URL(url).searchParams.get('name')!)))
        );
        await geocodeCity('Old town');
        vi.advanceTimersByTime(1000 * 60 * 60 + 1);
        await geocodeCity('New town');
        mockFetch.mockClear();
        await geocodeCity('Old town');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});

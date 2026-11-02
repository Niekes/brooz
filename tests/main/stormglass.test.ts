import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

let dir: string;
const mockFetch = vi.fn();

vi.mock('electron', () => ({
    app: { getPath: () => dir },
    net: { fetch: (...args: unknown[]) => mockFetch(...args) }
}));

const SPOT = { latitude: 38.99, longitude: -9.42 };
const ELSEWHERE = { latitude: 43.48, longitude: -1.56 };
const HOUR = 3600 * 1000;
/** 2026-11-02 08:00 UTC. */
const MORNING = Date.UTC(2026, 10, 2, 8);

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

const meta = (requestCount = 1) => ({ dailyQuota: 10, requestCount });

const weather = (requestCount?: number) => ({
    hours: [
        {
            time: '2026-11-02T08:00:00+00:00',
            waveHeight: { sg: 1.42 },
            swellPeriod: { sg: 11.3 },
            swellDirection: { sg: 292.6 },
            windSpeed: { sg: 3.4 },
            windDirection: { sg: 80 },
            waterTemperature: { sg: 17.26 }
        },
        // Off the water, Stormglass leaves a value out.
        { time: '2026-11-02T09:00:00+00:00', waveHeight: {} }
    ],
    meta: meta(requestCount)
});

const tides = {
    data: [
        { time: '2026-11-02T10:12:00+00:00', type: 'high', height: 1.234 },
        { time: '2026-11-02T16:30:00+00:00', type: 'low', height: -1.1 }
    ],
    meta: meta(2)
};

/** Answers the two endpoints; `status` makes both fail. */
function serve(status = 200, requestCount?: number): void {
    mockFetch.mockImplementation((url: string) => {
        if (status !== 200) {
            return Promise.resolve(json({ errors: {} }, status));
        }
        return Promise.resolve(
            json(new URL(url).pathname.includes('tide') ? tides : weather(requestCount))
        );
    });
}

async function stormglass(): Promise<typeof import('../../src/main/stormglass')> {
    return import('../../src/main/stormglass');
}

function calls(): URL[] {
    return mockFetch.mock.calls.map(([url]) => new URL(url as string));
}

describe('Stormglass', () => {
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'brooz-surf-'));
        mockFetch.mockReset();
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['Date'], now: MORNING });
        serve();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fetches the swell and the tides of the spot with the key in the header', async () => {
        const result = await (await stormglass()).fetchSurf('k1', SPOT);
        expect(result).toEqual({
            status: 'ok',
            data: {
                hours: [
                    {
                        time: '2026-11-02T08:00:00+00:00',
                        waveHeightM: 1.4,
                        swellPeriodS: 11.3,
                        swellDirection: 293,
                        windKmh: 12.2,
                        windDirection: 80,
                        waterTemperatureC: 17.3
                    },
                    {
                        time: '2026-11-02T09:00:00+00:00',
                        waveHeightM: null,
                        swellPeriodS: null,
                        swellDirection: null,
                        windKmh: null,
                        windDirection: null,
                        waterTemperatureC: null
                    }
                ],
                tides: [
                    { time: '2026-11-02T10:12:00+00:00', type: 'high' },
                    { time: '2026-11-02T16:30:00+00:00', type: 'low' }
                ],
                fetchedAt: '2026-11-02T08:00:00.000Z'
            }
        });
        const [swell, tide] = calls();
        expect(swell.pathname).toBe('/v2/weather/point');
        expect(swell.searchParams.get('lat')).toBe('38.99');
        expect(swell.searchParams.get('lng')).toBe('-9.42');
        expect(swell.searchParams.get('source')).toBe('sg');
        expect(tide.pathname).toBe('/v2/tide/extremes/point');
        expect(tide.searchParams.get('start')).toBe(String(Date.UTC(2026, 10, 2) / 1000));
        expect(mockFetch.mock.calls[0][1].headers).toEqual({ Authorization: 'k1' });
        expect(readFileSync(join(dir, 'stormglass-cache.json'), 'utf8')).not.toContain('k1');
    });

    it('spends one swell request per four hours and one tide request per day', async () => {
        const { fetchSurf } = await stormglass();
        await fetchSurf('k1', SPOT);
        vi.setSystemTime(MORNING + 4 * HOUR - 1);
        await fetchSurf('k1', SPOT);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        vi.setSystemTime(MORNING + 4 * HOUR);
        await fetchSurf('k1', SPOT);
        expect(calls().map((url) => url.pathname)).toEqual([
            '/v2/weather/point',
            '/v2/tide/extremes/point',
            '/v2/weather/point'
        ]);

        vi.setSystemTime(Date.UTC(2026, 10, 3, 1));
        await fetchSurf('k1', SPOT);
        expect(calls().at(-1)!.pathname).toBe('/v2/tide/extremes/point');
    });

    it('spends one request per job when the tile asks twice at once', async () => {
        const { fetchSurf } = await stormglass();
        const [first, second] = await Promise.all([fetchSurf('k1', SPOT), fetchSurf('k1', SPOT)]);
        expect(second).toEqual(first);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('keeps the forecast across a restart', async () => {
        await (await stormglass()).fetchSurf('k1', SPOT);
        vi.resetModules();
        const result = await (await stormglass()).fetchSurf('k1', SPOT);
        expect(result.status).toBe('ok');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('fetches again for another spot, and for another key', async () => {
        const { fetchSurf } = await stormglass();
        await fetchSurf('k1', SPOT);
        await fetchSurf('k1', ELSEWHERE);
        await fetchSurf('k2', ELSEWHERE);
        expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('starts empty from a corrupt cache file', async () => {
        writeFileSync(join(dir, 'stormglass-cache.json'), '{not json');
        const result = await (await stormglass()).fetchSurf('k1', SPOT);
        expect(result.status).toBe('ok');
    });

    it('serves the last forecast once the quota is spent, and calls again the next day', async () => {
        const { fetchSurf } = await stormglass();
        await fetchSurf('k1', SPOT);
        vi.setSystemTime(MORNING + 5 * HOUR);
        serve(402);
        const spent = await fetchSurf('k1', SPOT);
        expect(spent).toMatchObject({
            status: 'ok',
            data: { fetchedAt: '2026-11-02T08:00:00.000Z' }
        });
        expect(mockFetch).toHaveBeenCalledTimes(3);

        vi.setSystemTime(MORNING + 10 * HOUR);
        await fetchSurf('k1', SPOT);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        serve();
        vi.setSystemTime(Date.UTC(2026, 10, 3, 1));
        await fetchSurf('k1', SPOT);
        expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('stops calling once the reported request count reaches the quota', async () => {
        serve(200, 10);
        const { fetchSurf } = await stormglass();
        await fetchSurf('k1', SPOT);
        vi.setSystemTime(MORNING + 5 * HOUR);
        const result = await fetchSurf('k1', SPOT);
        expect(result.status).toBe('ok');
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Another key has its own quota.
        await fetchSurf('k2', SPOT);
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('says so when the quota is spent and there is no forecast to show', async () => {
        serve(402);
        const { fetchSurf } = await stormglass();
        const result = await fetchSurf('k1', SPOT);
        expect(result).toEqual({
            status: 'provider-error',
            message: "Stormglass's daily quota is used up. The forecast returns tomorrow."
        });
        // Swell and tides asked at once; after that, nothing until tomorrow.
        await fetchSurf('k1', SPOT);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('explains a rejected key, another status and an unreachable service', async () => {
        const { fetchSurf } = await stormglass();
        serve(401);
        expect(await fetchSurf('k1', SPOT)).toEqual({
            status: 'provider-error',
            message: "Stormglass doesn't accept this key."
        });
        serve(500);
        expect(await fetchSurf('k1', SPOT)).toEqual({
            status: 'provider-error',
            message: 'Stormglass replied with 500.'
        });
        mockFetch.mockRejectedValue('offline');
        expect(await fetchSurf('k1', SPOT)).toEqual({
            status: 'provider-error',
            message: 'Stormglass could not be reached.'
        });
    });

    it('tests a key with the tides of the last spot, and keeps them', async () => {
        const { fetchSurf, probeKey } = await stormglass();
        expect(await probeKey('k1')).toEqual({
            status: 'provider-error',
            message: 'Open the surf forecast once, then test the key.'
        });

        await fetchSurf('k1', SPOT);
        expect(await probeKey('k1')).toEqual({ status: 'ok' });
        expect(mockFetch).toHaveBeenCalledTimes(2);

        expect(await probeKey('k2')).toEqual({ status: 'ok' });
        expect(calls().at(-1)!.pathname).toBe('/v2/tide/extremes/point');
        serve(401);
        expect(await probeKey('k3')).toEqual({
            status: 'provider-error',
            message: "Stormglass doesn't accept this key."
        });
    });
});

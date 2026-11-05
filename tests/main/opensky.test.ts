import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchMock = vi.fn();

vi.mock('electron', () => ({
    net: { fetch: (...args: unknown[]) => fetchMock(...args) }
}));

vi.mock('../../src/main/airports', () => ({
    iataOf: async (icao: string) => ({ LFPO: 'ORY', KJFK: 'JFK' })[icao] ?? null
}));

/** A fresh module, so every test starts with an empty token and states cache. */
async function opensky(): Promise<typeof import('../../src/main/opensky')> {
    return import('../../src/main/opensky');
}

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

const TOKEN_URL = 'https://auth.opensky-network.org';
const FEED = 'https://opensky-network.org/api/states/all';
const LEGS = 'https://opensky-network.org/api/flights/aircraft';

const isTokenCall = (url: unknown): boolean => String(url).startsWith(TOKEN_URL);
const isFeedCall = (url: unknown): boolean => String(url).startsWith(FEED);

const FEED_TIME = 1762086600;
const LAST_CONTACT = 1762086540;

/** One row of the states feed; only the fields after the callsign vary. */
function row(
    callsign: string | null,
    over: {
        lastContact?: number | null;
        longitude?: number | null;
        latitude?: number | null;
        altitudeM?: number | null;
        onGround?: boolean;
        velocityMs?: number | null;
    } = {}
): unknown[] {
    return [
        'abc123',
        callsign,
        'Germany',
        null,
        over.lastContact === undefined ? LAST_CONTACT : over.lastContact,
        over.longitude === undefined ? 8.7 : over.longitude,
        over.latitude === undefined ? 50.1 : over.latitude,
        over.altitudeM === undefined ? 10000 : over.altitudeM,
        over.onGround ?? false,
        over.velocityMs === undefined ? 236.1 : over.velocityMs
    ];
}

/** Answers the token endpoint with `token`, the feed with `states`, the legs with `legs`. */
function mockFlow(
    token: string,
    states: unknown[] | null,
    tokenStatus = 200,
    legs: unknown[] = []
): void {
    fetchMock.mockImplementation(async (url: unknown) => {
        if (isTokenCall(url)) {
            return tokenStatus === 200
                ? ok({ access_token: token, expires_in: 1800 })
                : new Response('no', { status: tokenStatus });
        }
        if (String(url).startsWith(LEGS)) {
            return ok(legs);
        }
        return ok({ time: FEED_TIME, states });
    });
}

/** The init of the n-th call to `which` ('token' | 'feed'). */
function callInit(
    which: 'token' | 'feed',
    index = 0
): { method?: string; body?: string; headers: Record<string, string> } {
    const calls = fetchMock.mock.calls.filter(([url]) =>
        which === 'token' ? isTokenCall(url) : isFeedCall(url)
    ) as [string, { method?: string; body?: string; headers: Record<string, string> }][];
    return calls[index][1];
}

describe('the OpenSky provider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.resetModules();
    });

    it('exchanges the client for a token and sends it as a Bearer header, keeping the flights among the states', async () => {
        mockFlow('tok1', [row('DLH123'), row('BA456'), row(null), row('DLH1234')]);
        const api = await opensky();
        const result = await api.fetchFlights('my-id:my-secret', ['LH123']);
        expect(result).toEqual({
            status: 'ok',
            data: [
                {
                    icao24: 'abc123',
                    callsign: 'DLH123',
                    latitude: 50.1,
                    longitude: 8.7,
                    altitudeM: 10000,
                    speedKmh: 850,
                    onGround: false,
                    lastSeen: new Date(LAST_CONTACT * 1000).toISOString(),
                    origin: null,
                    destination: null,
                    departureAt: null,
                    arrivalAt: null
                }
            ]
        });
        const longer = await api.fetchFlights('my-id:my-secret', ['LH1234']);
        expect(longer.status === 'ok' && longer.data.map((state) => state.callsign)).toEqual([
            'DLH1234'
        ]);

        const tokenInit = callInit('token');
        expect(tokenInit.method).toBe('POST');
        const body = new URLSearchParams(tokenInit.body);
        expect(body.get('grant_type')).toBe('client_credentials');
        expect(body.get('client_id')).toBe('my-id');
        expect(body.get('client_secret')).toBe('my-secret');
        expect(callInit('feed').headers.Authorization).toBe('Bearer tok1');
    });

    it('matches a flight by number core when no callsign matches strictly, and prefers strict matches', async () => {
        mockFlow('tok1', [row('RYR4167'), row('BAW123'), row('DLH123')]);
        const api = await opensky();
        // FR4167 is served under Ryanair's ICAO code: core match.
        const byCore = await api.fetchFlights('id:secret', ['FR4167']);
        expect(byCore.status === 'ok' && byCore.data.map((s) => s.callsign)).toEqual(['RYR4167']);
        // LH123 has a strict match in DLH123, so BAW123 (same number) loses.
        const strict = await api.fetchFlights('id:secret', ['LH123']);
        expect(strict.status === 'ok' && strict.data.map((s) => s.callsign)).toEqual(['DLH123']);
    });

    it('maps the missing fields, and falls back to the feed time', async () => {
        mockFlow('tok1', [
            row('BA456', {
                lastContact: null,
                longitude: null,
                altitudeM: null,
                velocityMs: null,
                onGround: true
            })
        ]);
        const result = await (await opensky()).fetchFlights('id:secret', ['BA456']);
        expect(result).toEqual({
            status: 'ok',
            data: [
                {
                    icao24: 'abc123',
                    callsign: 'BA456',
                    latitude: 50.1,
                    longitude: null,
                    altitudeM: null,
                    speedKmh: null,
                    onGround: true,
                    lastSeen: new Date(FEED_TIME * 1000).toISOString(),
                    origin: null,
                    destination: null,
                    departureAt: null,
                    arrivalAt: null
                }
            ]
        });
    });

    it('answers an empty list when the feed has no states', async () => {
        mockFlow('tok1', null);
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({ status: 'ok', data: [] });
    });

    it('serves a repeat call from the token, feed and leg caches', async () => {
        mockFlow('tok1', [row('LH123')]);
        const api = await opensky();
        await api.fetchFlights('id:secret', ['LH123']);
        await api.fetchFlights('id:secret', ['LH123']);
        // First call: token, feed, one leg request. The repeat serves every cache.
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await api.fetchFlights('other:secret', ['LH123']);
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('refreshes the token shortly before it expires, once the feed is due again', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            let tokens = 0;
            fetchMock.mockImplementation(async (url: unknown) => {
                if (isTokenCall(url)) {
                    tokens += 1;
                    return ok({ access_token: `tok${tokens}`, expires_in: 60 });
                }
                if (String(url).startsWith(LEGS)) {
                    return ok([]);
                }
                return ok({ time: FEED_TIME, states: [row('LH123')] });
            });
            const api = await opensky();
            await api.fetchFlights('id:secret', ['LH123']);
            // 60 s token minus the 30 s margin, 60 s feed cache: all fresh at +29 s.
            vi.setSystemTime(Date.now() + 29_000);
            await api.fetchFlights('id:secret', ['LH123']);
            expect(fetchMock).toHaveBeenCalledTimes(3);
            // Past both: the feed is fetched again with a fresh token.
            vi.setSystemTime(Date.now() + 32_000);
            await api.fetchFlights('id:secret', ['LH123']);
            expect(fetchMock.mock.calls.filter(([url]) => isTokenCall(url))).toHaveLength(2);
            const feedCalls = fetchMock.mock.calls.filter(([url]) => isFeedCall(url)) as [
                string,
                { headers: Record<string, string> }
            ][];
            expect(feedCalls).toHaveLength(2);
            expect(feedCalls[1][1].headers.Authorization).toBe('Bearer tok2');
        } finally {
            vi.useRealTimers();
        }
    });

    it('falls back to the documented 30 minutes when the token says no expiry', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            fetchMock.mockImplementation(async (url: unknown) => {
                if (isTokenCall(url)) {
                    return ok({ access_token: 'tok' });
                }
                return ok({ time: FEED_TIME, states: [] });
            });
            const api = await opensky();
            await api.fetchFlights('id:secret', ['LH123']);
            vi.setSystemTime(Date.now() + 1_700_000);
            await api.fetchFlights('id:secret', ['LH123']);
            expect(fetchMock.mock.calls.filter(([url]) => isTokenCall(url))).toHaveLength(1);
            vi.setSystemTime(Date.now() + 71_000);
            await api.fetchFlights('id:secret', ['LH123']);
            expect(fetchMock.mock.calls.filter(([url]) => isTokenCall(url))).toHaveLength(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('refreshes the token once and retries the feed once on a 401', async () => {
        let feedCalls = 0;
        fetchMock.mockImplementation(async (url: unknown) => {
            if (isTokenCall(url)) {
                return ok({ access_token: `tok${feedCalls + 1}`, expires_in: 1800 });
            }
            if (String(url).startsWith(LEGS)) {
                return ok([]);
            }
            feedCalls += 1;
            return feedCalls === 1
                ? new Response('expired', { status: 401 })
                : ok({ time: FEED_TIME, states: [row('LH123')] });
        });
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result.status).toBe('ok');
        expect(fetchMock.mock.calls.filter(([url]) => isTokenCall(url))).toHaveLength(2);
        const feedCallsList = fetchMock.mock.calls.filter(([url]) => isFeedCall(url)) as [
            string,
            { headers: Record<string, string> }
        ][];
        expect(feedCallsList).toHaveLength(2);
        expect(feedCallsList[1][1].headers.Authorization).toBe('Bearer tok2');
    });

    it('answers with the provider error for a feed status that is not 401 or 403', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (isTokenCall(url)) {
                return ok({ access_token: 'tok', expires_in: 1800 });
            }
            return new Response('slow down', { status: 429 });
        });
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky replied with 429.'
        });
        // Not an expiry, so no retry.
        expect(fetchMock.mock.calls.filter(([url]) => isFeedCall(url))).toHaveLength(1);
    });

    it('treats a 403 from the feed like an expired token and retries once', async () => {
        let feedCalls = 0;
        fetchMock.mockImplementation(async (url: unknown) => {
            if (isTokenCall(url)) {
                return ok({ access_token: 'tok', expires_in: 1800 });
            }
            feedCalls += 1;
            return new Response('no', { status: 403 });
        });
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this key."
        });
        expect(feedCalls).toBe(2);
    });

    it('answers with the provider error when the retry is rejected too', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (isTokenCall(url)) {
                return ok({ access_token: 'tok', expires_in: 1800 });
            }
            return new Response('no', { status: 401 });
        });
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this key."
        });
    });

    it('answers with the provider error when the token endpoint rejects the client', async () => {
        mockFlow('tok', [], 400);
        const api = await opensky();
        expect(await api.fetchFlights('id:secret', ['LH123'])).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this client id and secret."
        });
        fetchMock.mockReset();
        mockFlow('tok', [], 500);
        expect(await api.fetchFlights('id:secret', ['LH123'])).toEqual({
            status: 'provider-error',
            message: 'OpenSky replied with 500.'
        });
    });

    it('answers with the provider error for a key that is not clientId:clientSecret', async () => {
        const api = await opensky();
        for (const key of ['noseparator', 'id:', ':secret']) {
            expect(await api.fetchFlights(key, ['LH123'])).toEqual({
                status: 'provider-error',
                message: 'The OpenSky key is the API client written as clientId:clientSecret.'
            });
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers with the provider error when the token response has no token', async () => {
        fetchMock.mockImplementation(async (url: unknown) =>
            isTokenCall(url) ? ok({}) : ok({ time: FEED_TIME, states: [] })
        );
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky sent no access token.'
        });
    });

    it('answers with the provider error when the token request times out', async () => {
        fetchMock.mockRejectedValue(new DOMException('aborted', 'TimeoutError'));
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky did not answer in time.'
        });
    });

    it('answers with the provider error when the failure has no message', async () => {
        fetchMock.mockRejectedValue('the wire is cut');
        const result = await (await opensky()).fetchFlights('id:secret', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky could not be reached.'
        });
    });

    it('enriches a matched state with its leg, the one in progress, airports as IATA when known', async () => {
        const now = Math.floor(Date.now() / 1000);
        mockFlow('tok1', [row('UA900')], 200, [
            // An older, finished leg and the current one.
            {
                estDepartureAirport: 'KLAX',
                estArrivalAirport: 'KSFO',
                firstSeen: now - 7200,
                lastSeen: now - 3600
            },
            {
                estDepartureAirport: 'LFPO',
                estArrivalAirport: 'KJFK',
                firstSeen: now - 3600,
                lastSeen: now + 3 * 3600
            },
            { estDepartureAirport: 'XXXX', firstSeen: now - 100, lastSeen: null }
        ]);
        const result = await (await opensky()).fetchFlights('id:secret', ['UA900']);
        expect(result.status === 'ok' && result.data[0]).toMatchObject({
            callsign: 'UA900',
            // LFPO maps to ORY, KJFK to JFK; an unknown code falls back to itself.
            origin: 'ORY',
            destination: 'JFK',
            departureAt: new Date((now - 3600) * 1000).toISOString(),
            arrivalAt: new Date((now + 3 * 3600) * 1000).toISOString()
        });
    });

    it('caches the leg per aircraft, and leaves the fields null when the leg endpoint fails', async () => {
        fetchMock.mockImplementation(async (url: unknown) => {
            if (isTokenCall(url)) {
                return ok({ access_token: 'tok', expires_in: 1800 });
            }
            if (String(url).startsWith(LEGS)) {
                return new Response('no', { status: 500 });
            }
            return ok({ time: FEED_TIME, states: [row('UA900')] });
        });
        const api = await opensky();
        const first = await api.fetchFlights('id:secret', ['UA900']);
        expect(first.status === 'ok' && first.data[0]).toMatchObject({
            origin: null,
            destination: null,
            departureAt: null,
            arrivalAt: null
        });
        await api.fetchFlights('id:secret', ['UA900']);
        // The leg failure is cached too: one legs request in total.
        expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith(LEGS))).toHaveLength(
            1
        );
    });

    it('picks the latest departed leg when none is in progress, and null without times', async () => {
        const now = Math.floor(Date.now() / 1000);
        // Both legs finished; the latest one wins, with no lastSeen -> no arrival time.
        mockFlow('tok1', [row('QF11')], 200, [
            {
                estDepartureAirport: 'SYD',
                estArrivalAirport: 'MEL',
                firstSeen: now - 7200,
                lastSeen: now - 3600
            },
            {
                estArrivalAirport: 'ZZZZ',
                firstSeen: now + 3600,
                lastSeen: null
            }
        ]);
        const result = await (await opensky()).fetchFlights('id:secret', ['QF11']);
        // No leg in progress: the latest one wins the sort. No departure airport
        // stays null; an ICAO code without an IATA mapping falls back to itself.
        expect(result.status === 'ok' && result.data[0]).toMatchObject({
            origin: null,
            destination: 'ZZZZ',
            departureAt: new Date((now + 3600) * 1000).toISOString(),
            arrivalAt: null
        });

        mockFlow('tok1', [row('QF11')], 200, [
            { estDepartureAirport: 'ZZZZ', firstSeen: now + 3600, lastSeen: now + 7200 }
        ]);
        // A third key: the chosen leg has an unmapped origin ICAO (falls back to
        // itself) and no arrival airport (stays null).
        const fallback = await (await opensky()).fetchFlights('third:secret', ['QF11']);
        expect(fallback.status === 'ok' && fallback.data[0]).toMatchObject({
            origin: 'ZZZZ',
            destination: null,
            arrivalAt: new Date((now + 7200) * 1000).toISOString()
        });

        mockFlow('tok1', [row('QF11')], 200, [{ estDepartureAirport: 'SYD' }]);
        // Another key, so the leg cache of the first part does not answer.
        const untimed = await (await opensky()).fetchFlights('other:secret', ['QF11']);
        expect(untimed.status === 'ok' && untimed.data[0]).toMatchObject({
            origin: null,
            destination: null,
            departureAt: null
        });
    });

    it('probes a key by fetching a token and the feed once', async () => {
        mockFlow('tok1', [row('LH123')]);
        const api = await opensky();
        expect(await api.probeKey('id:secret')).toEqual({ status: 'ok' });

        fetchMock.mockReset();
        mockFlow('tok', [], 400);
        // Another key, so the feed cache of the first probe does not answer.
        expect(await api.probeKey('bad:secret')).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this client id and secret."
        });
    });
});

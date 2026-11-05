import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchMock = vi.fn();

vi.mock('electron', () => ({
    net: { fetch: (...args: unknown[]) => fetchMock(...args) }
}));

/** A fresh module, so every test starts with an empty states cache. */
async function opensky(): Promise<typeof import('../../src/main/opensky')> {
    return import('../../src/main/opensky');
}

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

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

describe('the OpenSky provider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.resetModules();
    });

    it('keeps the flights among the states, and sends the key as a Basic header', async () => {
        fetchMock.mockResolvedValue(
            ok({
                time: FEED_TIME,
                states: [row('DLH123'), row('BA456'), row(null), row('DLH1234')]
            })
        );
        const api = await opensky();
        const result = await api.fetchFlights('user:pass', ['LH123']);
        expect(result).toEqual({
            status: 'ok',
            data: [
                {
                    callsign: 'DLH123',
                    latitude: 50.1,
                    longitude: 8.7,
                    altitudeM: 10000,
                    speedKmh: 850,
                    onGround: false,
                    lastSeen: new Date(LAST_CONTACT * 1000).toISOString()
                }
            ]
        });
        // The longer number matches its own callsign, not the shorter one.
        const longer = await api.fetchFlights('user:pass', ['LH1234']);
        expect(longer.status === 'ok' && longer.data.map((state) => state.callsign)).toEqual([
            'DLH1234'
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [
            string,
            { headers: Record<string, string> }
        ];
        expect(url).toBe('https://opensky-network.org/api/states/all');
        expect(init.headers.Authorization).toBe(
            `Basic ${Buffer.from('user:pass').toString('base64')}`
        );
    });

    it('maps the missing fields, and falls back to the feed time', async () => {
        fetchMock.mockResolvedValue(
            ok({
                time: FEED_TIME,
                states: [
                    row('BA456', {
                        lastContact: null,
                        longitude: null,
                        altitudeM: null,
                        velocityMs: null,
                        onGround: true
                    })
                ]
            })
        );
        const result = await (await opensky()).fetchFlights('k1', ['BA456']);
        expect(result).toEqual({
            status: 'ok',
            data: [
                {
                    callsign: 'BA456',
                    latitude: 50.1,
                    longitude: null,
                    altitudeM: null,
                    speedKmh: null,
                    onGround: true,
                    lastSeen: new Date(FEED_TIME * 1000).toISOString()
                }
            ]
        });
    });

    it('answers an empty list when the feed has no states', async () => {
        fetchMock.mockResolvedValue(ok({ time: FEED_TIME, states: null }));
        const result = await (await opensky()).fetchFlights('k1', ['LH123']);
        expect(result).toEqual({ status: 'ok', data: [] });
    });

    it('serves a repeat call from the cache, and a new key from the service', async () => {
        fetchMock.mockResolvedValue(ok({ time: FEED_TIME, states: [row('LH123')] }));
        const api = await opensky();
        await api.fetchFlights('k1', ['LH123']);
        await api.fetchFlights('k1', ['LH123']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await api.fetchFlights('k2', ['LH123']);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('answers with the provider error when the service rejects the key', async () => {
        fetchMock.mockResolvedValue(new Response('no', { status: 401 }));
        const result = await (await opensky()).fetchFlights('k1', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this key."
        });
    });

    it('answers with the provider error for any other status', async () => {
        fetchMock.mockResolvedValue(new Response('no', { status: 429 }));
        const result = await (await opensky()).fetchFlights('k1', ['LH123']);
        expect(result).toEqual({ status: 'provider-error', message: 'OpenSky replied with 429.' });
    });

    it('answers with the provider error when the service is unreachable', async () => {
        fetchMock.mockRejectedValue(new DOMException('aborted', 'TimeoutError'));
        const result = await (await opensky()).fetchFlights('k1', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky did not answer in time.'
        });
    });

    it('answers with the provider error when the failure has no message', async () => {
        fetchMock.mockRejectedValue('the wire is cut');
        const result = await (await opensky()).fetchFlights('k1', ['LH123']);
        expect(result).toEqual({
            status: 'provider-error',
            message: 'OpenSky could not be reached.'
        });
    });

    it('probes a key against the service', async () => {
        fetchMock.mockResolvedValue(ok({ time: FEED_TIME, states: [] }));
        const api = await opensky();
        expect(await api.probeKey('k1')).toEqual({ status: 'ok' });

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response('no', { status: 403 }));
        expect(await api.probeKey('k2')).toEqual({
            status: 'provider-error',
            message: "OpenSky doesn't accept this key."
        });
    });
});

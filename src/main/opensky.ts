import { createHash } from 'node:crypto';
import type { ProviderOutcome, ProviderProbe } from '../shared/providers';
import { callsignMatches, normalizeFlight } from '../shared/flights';
import type { FlightState } from '../shared/flights';
import { createCache, fetchJson, outcome } from './http';

/**
 * OpenSky Network, the provider of the flight tracker tile. Its states feed
 * answers the live position of every aircraft, so the tile's flights are the
 * matching callsigns among them. The key is an OpenSky account written as
 * `username:password` and goes in a Basic header; it never enters the cache,
 * which knows its key by a short hash only, so a rotated key misses it.
 * The whole feed is cached for a minute: the states change every few seconds,
 * and switching between live tiles must not refetch them.
 */

const API = 'https://opensky-network.org/api/states/all';
const SERVICE = 'OpenSky';
const STATES_TTL = 60_000;

/** One row of the states answer; only the fields the tile reads are typed. */
type RawState = readonly [
    icao24: string,
    callsign: string | null,
    originCountry: string,
    timePosition: number | null,
    lastContact: number | null,
    longitude: number | null,
    latitude: number | null,
    baroAltitudeM: number | null,
    onGround: boolean,
    velocityMs: number | null,
    ...rest: unknown[]
];

interface StatesRaw {
    time: number;
    states: RawState[] | null;
}

const cache = createCache(STATES_TTL);

function cacheKeyOf(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function authHeader(key: string): Record<string, string> {
    return { Authorization: `Basic ${Buffer.from(key, 'utf8').toString('base64')}` };
}

function rejected(status: number): string {
    return status === 401 || status === 403
        ? "OpenSky doesn't accept this key."
        : `${SERVICE} replied with ${status}.`;
}

function toState(raw: RawState, feedTime: number): FlightState {
    const [, callsign, , , lastContact, longitude, latitude, altitudeM, onGround, velocityMs] = raw;
    return {
        callsign: callsign ?? '',
        latitude,
        longitude,
        altitudeM,
        speedKmh: velocityMs === null ? null : Math.round(velocityMs * 3.6 * 10) / 10,
        onGround,
        lastSeen: new Date((lastContact ?? feedTime) * 1000).toISOString()
    };
}

/** The whole feed, from the cache while it is fresh. */
async function allStates(key: string): Promise<FlightState[]> {
    const cacheKey = cacheKeyOf(key);
    const cached = cache.read<FlightState[]>(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const raw = await fetchJson<StatesRaw>(new URL(API), SERVICE, rejected, authHeader(key));
    const states = (raw.states ?? [])
        .map((row) => toState(row, raw.time))
        .filter((state) => state.callsign.length > 0);
    return cache.write(cacheKey, states);
}

/** The live states of the flights, or the provider's own error - never a throw. */
export async function fetchFlights(
    key: string,
    flights: readonly string[]
): Promise<ProviderOutcome<FlightState[]>> {
    return outcome(SERVICE, async () => {
        const states = await allStates(key);
        const wanted = flights.map(normalizeFlight);
        return states.filter((state) =>
            wanted.some((flight) => callsignMatches(state.callsign, flight))
        );
    });
}

/** Checks a key against the service with the live states. */
export async function probeKey(key: string): Promise<ProviderProbe> {
    const result = await outcome(SERVICE, () => allStates(key));
    return result.status === 'ok' ? { status: 'ok' } : result;
}

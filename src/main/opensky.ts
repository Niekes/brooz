import { createHash } from 'node:crypto';
import type { ProviderOutcome, ProviderProbe } from '../shared/providers';
import { callsignCoreMatches, callsignMatches, normalizeFlight } from '../shared/flights';
import type { FlightState } from '../shared/flights';
import { createCache, fetchJson, outcome } from './http';

/**
 * OpenSky Network, the provider of the flight tracker tile. Its states feed
 * answers the live position of every aircraft, so the tile's flights are the
 * matching callsigns among them. OpenSky exclusively supports the OAuth2
 * client credentials flow, so the key is the API client written as
 * `clientId:clientSecret` (`docs/adr/0017`): only this module splits it, and
 * only it exchanges it for a bearer token. The token is cached until shortly
 * before it expires; a 401 or 403 from the feed means the token expired or
 * the client is wrong, so the token is refreshed once and the request retried
 * once. The feed itself is cached for a minute, and every cache knows its key
 * by a short hash only, so a rotated key misses them all.
 */

const API = 'https://opensky-network.org/api/states/all';
const LEGS_API = 'https://opensky-network.org/api/flights/aircraft';
const TOKEN_URL =
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const SERVICE = 'OpenSky';
const STATES_TTL = 60_000;
/** A leg changes rarely: the airports of a flight stay the same for hours. */
const LEG_TTL = 10 * 60_000;
/** Refresh the token this long before it expires. */
const TOKEN_MARGIN = 30_000;
/** The feed's 401/403 message: the one signal that means refresh and retry. */
const TOKEN_REJECTED = "OpenSky doesn't accept this key.";

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

interface TokenRaw {
    access_token?: unknown;
    expires_in?: unknown;
}

/** One leg of an aircraft, as the flights endpoint reports it. */
interface LegRaw {
    estDepartureAirport?: string | null;
    estArrivalAirport?: string | null;
    firstSeen?: number | null;
    lastSeen?: number | null;
}

/** The leg fields the tile reads. */
type Leg = Pick<FlightState, 'origin' | 'destination' | 'departureAt' | 'arrivalAt'>;

const statesCache = createCache(STATES_TTL);
const legsCache = createCache(LEG_TTL);

/** The bearer token of one key, cached until shortly before it expires. */
let tokenCache: { hashed: string; token: string; notAfter: number } | null = null;

function hashOf(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** The key is one string: the API client's id and secret, `clientId:clientSecret`. */
function credentialsOf(key: string): { clientId: string; clientSecret: string } {
    const at = key.indexOf(':');
    if (at <= 0 || at === key.length - 1) {
        throw new Error('The OpenSky key is the API client written as clientId:clientSecret.');
    }
    return { clientId: key.slice(0, at), clientSecret: key.slice(at + 1) };
}

function tokenRejected(status: number): string {
    return status === 400 || status === 401 || status === 403
        ? "OpenSky doesn't accept this client id and secret."
        : `${SERVICE} replied with ${status}.`;
}

/** Exchanges the client for a bearer token and caches it until near its expiry. */
async function fetchToken(key: string): Promise<string> {
    const { clientId, clientSecret } = credentialsOf(key);
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
    });
    const raw = await fetchJson<TokenRaw>(
        new URL(TOKEN_URL),
        SERVICE,
        tokenRejected,
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        { method: 'POST', body: body.toString() }
    );
    if (typeof raw.access_token !== 'string' || raw.access_token.length === 0) {
        throw new Error(`${SERVICE} sent no access token.`);
    }
    const expiresIn = typeof raw.expires_in === 'number' ? raw.expires_in : 1800;
    tokenCache = {
        hashed: hashOf(key),
        token: raw.access_token,
        notAfter: Date.now() + Math.max(0, expiresIn * 1000 - TOKEN_MARGIN)
    };
    return raw.access_token;
}

/** A fresh cached token for the key, else a new one. */
function accessToken(key: string): Promise<string> {
    const hashed = hashOf(key);
    if (tokenCache !== null && tokenCache.hashed === hashed && Date.now() < tokenCache.notAfter) {
        return Promise.resolve(tokenCache.token);
    }
    return fetchToken(key);
}

function rejected(status: number): string {
    return status === 401 || status === 403 ? TOKEN_REJECTED : `${SERVICE} replied with ${status}.`;
}

/** One feed request with a bearer token. */
function feedOnce(token: string): Promise<StatesRaw> {
    return fetchJson<StatesRaw>(new URL(API), SERVICE, rejected, {
        Authorization: `Bearer ${token}`
    });
}

/** The feed, retrying once with a fresh token when the old one expired. */
async function fetchFeed(key: string): Promise<StatesRaw> {
    try {
        return await feedOnce(await accessToken(key));
    } catch (cause) {
        if (cause instanceof Error && cause.message === TOKEN_REJECTED) {
            tokenCache = null;
            return feedOnce(await accessToken(key));
        }
        throw cause;
    }
}

function toState(raw: RawState, feedTime: number): FlightState {
    const [
        icao24,
        callsign,
        ,
        ,
        lastContact,
        longitude,
        latitude,
        altitudeM,
        onGround,
        velocityMs
    ] = raw;
    return {
        icao24,
        callsign: callsign ?? '',
        latitude,
        longitude,
        altitudeM,
        speedKmh: velocityMs === null ? null : Math.round(velocityMs * 3.6 * 10) / 10,
        onGround,
        lastSeen: new Date((lastContact ?? feedTime) * 1000).toISOString(),
        origin: null,
        destination: null,
        departureAt: null,
        arrivalAt: null
    };
}

/** The whole feed, from the cache while it is fresh. */
async function allStates(key: string): Promise<FlightState[]> {
    const cacheKey = hashOf(key);
    const cached = statesCache.read<FlightState[]>(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const raw = await fetchFeed(key);
    const states = (raw.states ?? [])
        .map((row) => toState(row, raw.time))
        .filter((state) => state.callsign.length > 0);
    return statesCache.write(cacheKey, states);
}

/**
 * The states of one flight: the strict callsign matches win, and only when
 * there are none does the number core match across airline codes (FR4167 is
 * served as RYR4167), so a shared number never outranks a real callsign.
 */
function statesOf(states: readonly FlightState[], flight: string): FlightState[] {
    const strict = states.filter((state) => callsignMatches(state.callsign, flight));
    if (strict.length > 0) {
        return strict;
    }
    return states.filter((state) => callsignCoreMatches(state.callsign, flight));
}

/** The leg in progress, or the latest one that has departed; null without times. */
function pickLeg(legs: readonly LegRaw[], now: number): Leg | null {
    const timed = legs.filter((leg) => typeof leg.firstSeen === 'number');
    const inProgress = timed.filter(
        (leg) => leg.firstSeen! <= now && (leg.lastSeen == null || leg.lastSeen >= now)
    );
    const chosen = inProgress[0] ?? [...timed].sort((a, b) => b.firstSeen! - a.firstSeen!)[0];
    if (chosen === undefined) {
        return null;
    }
    return {
        origin: chosen.estDepartureAirport ?? null,
        destination: chosen.estArrivalAirport ?? null,
        departureAt: new Date(chosen.firstSeen! * 1000).toISOString(),
        arrivalAt:
            typeof chosen.lastSeen === 'number'
                ? new Date(chosen.lastSeen * 1000).toISOString()
                : null
    };
}

/**
 * The leg of an aircraft, from the flights endpoint, cached per aircraft. A
 * leg that cannot be fetched is null - the states are the primary data, so a
 * leg failure never fails the tile.
 */
async function legOf(key: string, state: FlightState): Promise<Leg | null> {
    const cacheKey = `${hashOf(key)}:${state.icao24}`;
    const cached = legsCache.read<Leg | null>(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const now = Math.floor(Date.now() / 1000);
    const url = new URL(LEGS_API);
    url.searchParams.set('icao24', state.icao24);
    url.searchParams.set('begin', String(now - 12 * 3600));
    url.searchParams.set('end', String(now + 6 * 3600));
    let leg: Leg | null = null;
    try {
        const legs = await fetchJson<LegRaw[]>(url, SERVICE, rejected, {
            Authorization: `Bearer ${await accessToken(key)}`
        });
        leg = pickLeg(legs, now);
    } catch {
        leg = null;
    }
    return legsCache.write(cacheKey, leg);
}

/** The live states of the flights, or the provider's own error - never a throw. */
export async function fetchFlights(
    key: string,
    flights: readonly string[]
): Promise<ProviderOutcome<FlightState[]>> {
    return outcome(SERVICE, async () => {
        const states = await allStates(key);
        const matched = flights.map(normalizeFlight).flatMap((flight) => statesOf(states, flight));
        return Promise.all(
            matched.map(async (state) => ({ ...state, ...(await legOf(key, state)) }))
        );
    });
}

/** Checks a key by fetching a token and the feed once. */
export async function probeKey(key: string): Promise<ProviderProbe> {
    const result = await outcome(SERVICE, () => allStates(key));
    return result.status === 'ok' ? { status: 'ok' } : result;
}

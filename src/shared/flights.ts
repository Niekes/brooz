/**
 * The data the flight channel carries. The main process fetches the live
 * states from OpenSky Network and keeps the flights the tile asked for; the
 * flight tracker tile renders them. Times are ISO strings in UTC.
 */

/** How many flights one live flight tile tracks. */
export const MAX_FLIGHTS = 5;

/**
 * A flight number or callsign the way a person writes it: an airline code,
 * digits and up to two suffix letters, like LH123, OR1638 or TFL2DW.
 */
const FLIGHT_PATTERN = /^[A-Z]{2,3}[0-9]{1,4}[A-Z]{0,2}$/;

/** The flight number as a comparable token: upper case, letters and digits only. */
export function normalizeFlight(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Whether `value` is shaped like a flight number once normalized. */
export function isFlightNumber(value: string): boolean {
    return FLIGHT_PATTERN.test(normalizeFlight(value));
}

/**
 * Whether a live callsign belongs to the flight a person asked for, strictly:
 * the callsign is the flight number, or carries it as a suffix, because the
 * service often spells LH123 with the airline's ICAO code, DLH123.
 */
export function callsignMatches(callsign: string, flight: string): boolean {
    const normalized = normalizeFlight(callsign);
    const wanted = normalizeFlight(flight);
    return normalized === wanted || (wanted.length >= 3 && normalized.endsWith(wanted));
}

/** The number core of a flight: digits and suffix letters without the airline code. */
function coreOf(value: string): string {
    return normalizeFlight(value).replace(/^[A-Z]+/, '');
}

/**
 * Whether a callsign shares the flight's number core, across airline codes:
 * the person asks for the IATA flight number FR4167, the service spells the
 * callsign with the ICAO code, RYR4167. Cores shorter than three characters
 * (BA1) match nothing, so a bare number never matches every airline.
 */
export function callsignCoreMatches(callsign: string, flight: string): boolean {
    const core = coreOf(flight);
    return core.length >= 3 && coreOf(callsign) === core;
}

/** One live flight state, as the states feed reports it. */
export interface FlightState {
    readonly callsign: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
    /** Barometric altitude in meters, null on the ground or when unknown. */
    readonly altitudeM: number | null;
    readonly speedKmh: number | null;
    readonly onGround: boolean;
    /** When the state was last seen, ISO 8601 UTC. */
    readonly lastSeen: string;
}

/** Where the flight is right now. */
export type FlightPhase = 'en-route' | 'on-ground' | 'no-position';

/** The phase of a state: on the ground first, then a position is needed to be en route. */
export function flightPhase(state: FlightState): FlightPhase {
    if (state.onGround) {
        return 'on-ground';
    }
    if (state.latitude === null || state.longitude === null) {
        return 'no-position';
    }
    return 'en-route';
}

const FEET = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** The altitude in feet, the way aviation writes it, or a dash. */
export function formatAltitude(altitudeM: number | null): string {
    return altitudeM === null ? '—' : `${FEET.format(Math.round(altitudeM * 3.28084))} ft`;
}

/** The ground speed in km/h, or a dash. */
export function formatSpeed(speedKmh: number | null): string {
    return speedKmh === null ? '—' : `${Math.round(speedKmh)} km/h`;
}

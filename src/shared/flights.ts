/**
 * The data the flight channel carries. The main process fetches the live
 * states from OpenSky Network and keeps the flights the tile asked for; the
 * flight tracker tile renders them. Times are ISO strings in UTC.
 */

/** How many flights one live flight tile tracks. */
export const MAX_FLIGHTS = 5;

/** A flight number the way a person writes it: an airline code and digits, like LH123. */
const FLIGHT_PATTERN = /^[A-Z]{2,3}[0-9]{1,4}[A-Z]?$/;

/** The flight number as a comparable token: upper case, letters and digits only. */
export function normalizeFlight(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Whether `value` is shaped like a flight number once normalized. */
export function isFlightNumber(value: string): boolean {
    return FLIGHT_PATTERN.test(normalizeFlight(value));
}

/**
 * Whether a live callsign belongs to the flight a person asked for: the
 * callsign is the flight number, or carries it as a suffix, because the
 * service often spells LH123 with the airline's ICAO code, DLH123.
 */
export function callsignMatches(callsign: string, flight: string): boolean {
    const normalized = normalizeFlight(callsign);
    const wanted = normalizeFlight(flight);
    return normalized === wanted || (wanted.length >= 3 && normalized.endsWith(wanted));
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

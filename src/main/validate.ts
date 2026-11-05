import type { Coordinates, PlaceQuery } from '../shared/weather';
import { providerExists } from '../shared/providers';
import { MAX_QUOTE_SYMBOLS } from '../shared/quotes';
import { isFlightNumber, normalizeFlight, MAX_FLIGHTS } from '../shared/flights';
import type { ProviderId } from '../shared/providers';

const MAX_CITY_LENGTH = 100;
const MAX_KEY_LENGTH = 256;
/** How a person writes a ticker: letters, digits, dots and dashes. */
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,12}$/;

/**
 * The renderer is untrusted input: a city is a short, non-empty string, and
 * coordinates are finite and on the globe. Anything else never reaches the
 * network.
 */
export function parseCity(value: unknown): string {
    if (typeof value !== 'string') {
        throw new TypeError('A city must be a string.');
    }
    const city = value.trim();
    if (city.length === 0 || city.length > MAX_CITY_LENGTH) {
        throw new RangeError(`A city has 1 to ${MAX_CITY_LENGTH} characters.`);
    }
    return city;
}

function inRange(value: unknown, limit: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export function parsePlaceQuery(value: unknown): PlaceQuery {
    if (typeof value === 'object' && value !== null && 'city' in value) {
        return { city: parseCity(value.city) };
    }
    return parseCoordinates(value);
}

/** Coordinates on the globe; nothing else reaches the network. */
export function parseCoordinates(value: unknown): Coordinates {
    if (typeof value !== 'object' || value === null) {
        throw new TypeError('A place is a city or coordinates.');
    }
    const { latitude, longitude } = value as Record<string, unknown>;
    if (!inRange(latitude, 90) || !inRange(longitude, 180)) {
        throw new RangeError('Coordinates are out of range.');
    }
    return { latitude, longitude };
}

/** A provider the manifest knows; anything else has no channels. */
export function parseProviderId(value: unknown): ProviderId {
    if (typeof value !== 'string' || !providerExists(value)) {
        throw new TypeError('Unknown provider.');
    }
    return value;
}

/** A key is a short, non-empty string; it never reaches anything else. */
export function parseKeyInput(value: unknown): string {
    if (typeof value !== 'string') {
        throw new TypeError('A key must be a string.');
    }
    const key = value.trim();
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
        throw new RangeError(`A key has 1 to ${MAX_KEY_LENGTH} characters.`);
    }
    return key;
}

/**
 * A handful of ticker symbols. The renderer is untrusted input, so a symbol
 * is a short uppercase token or the request never reaches the network.
 */
export function parseSymbols(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_QUOTE_SYMBOLS) {
        throw new TypeError(`Symbols are a list of 1 to ${MAX_QUOTE_SYMBOLS} tickers.`);
    }
    const symbols = value.map((symbol) => {
        if (typeof symbol !== 'string') {
            throw new TypeError('Symbols are a list of tickers.');
        }
        return symbol.toUpperCase();
    });
    if (!symbols.every((symbol) => SYMBOL_PATTERN.test(symbol))) {
        throw new RangeError('A ticker is at most 12 letters, digits, dots or dashes.');
    }
    return [...new Set(symbols)];
}

/**
 * A handful of flight numbers. The renderer is untrusted input, so a flight
 * is a short airline code with digits, normalized to upper case; anything
 * else never reaches the network.
 */
export function parseFlights(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FLIGHTS) {
        throw new TypeError(`Flights are a list of 1 to ${MAX_FLIGHTS} flight numbers.`);
    }
    const flights = value.map((flight) => {
        if (typeof flight !== 'string') {
            throw new TypeError('Flights are a list of flight numbers.');
        }
        return normalizeFlight(flight);
    });
    if (!flights.every(isFlightNumber)) {
        throw new RangeError('A flight number is 2-3 letters, 1-4 digits and up to two letters.');
    }
    return [...new Set(flights)];
}

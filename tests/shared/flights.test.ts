import { describe, expect, it } from 'vite-plus/test';
import {
    callsignCoreMatches,
    callsignMatches,
    flightPhase,
    formatAltitude,
    formatSpeed,
    isFlightNumber,
    legProgress,
    normalizeFlight
} from '../../src/shared/flights';
import type { FlightState } from '../../src/shared/flights';

describe('the flight numbers', () => {
    it('normalizes to upper case letters and digits', () => {
        expect(normalizeFlight(' lh-123 ')).toBe('LH123');
        expect(normalizeFlight('DLH4321')).toBe('DLH4321');
    });

    it.each([
        ['LH123', true],
        ['DLH4321', true],
        ['BA456A', true],
        ['OR1638', true],
        ['TFL2DW', true],
        ['AAPL', false],
        ['LH', false],
        ['!!!', false],
        ['12345', false]
    ])('isFlightNumber(%j) is %s', (value, expected) => {
        expect(isFlightNumber(value)).toBe(expected);
    });

    it('matches a callsign by the flight number or its suffix', () => {
        expect(callsignMatches('LH123', 'LH123')).toBe(true);
        expect(callsignMatches('DLH123', 'LH123')).toBe(true);
        expect(callsignMatches('DLH1234', 'LH1234')).toBe(true);
        expect(callsignMatches('DLH1234', 'LH123')).toBe(false);
        expect(callsignMatches('LH1234', 'LH123')).toBe(false);
        expect(callsignMatches('BA456', 'LH123')).toBe(false);
        // A two-letter want is too short to match as a suffix.
        expect(callsignMatches('XXBA', 'BA')).toBe(false);
        expect(callsignMatches('BA', 'BA')).toBe(true);
    });

    it('matches a callsign by its number core across airline codes', () => {
        expect(callsignCoreMatches('RYR4167', 'FR4167')).toBe(true);
        expect(callsignCoreMatches('TUI1638', 'OR1638')).toBe(true);
        expect(callsignCoreMatches('DLH123', 'LH123')).toBe(true);
        expect(callsignCoreMatches('RYR4167', 'FR4168')).toBe(false);
        expect(callsignCoreMatches('BA456', 'LH123')).toBe(false);
        // A core shorter than three characters matches nothing.
        expect(callsignCoreMatches('BAW41', 'FR41')).toBe(false);
        expect(callsignCoreMatches('XXBA', 'BA')).toBe(false);
    });
});

describe('the flight state', () => {
    const state = (part: Partial<FlightState>): FlightState => ({
        icao24: 'abc123',
        callsign: 'DLH123',
        latitude: 50.1,
        longitude: 8.7,
        altitudeM: 10000,
        speedKmh: 850,
        onGround: false,
        lastSeen: '2026-11-02T09:30:00.000Z',
        origin: null,
        destination: null,
        departureAt: null,
        arrivalAt: null,
        ...part
    });

    it('is en route with a position, on the ground first, else without a position', () => {
        expect(flightPhase(state({}))).toBe('en-route');
        expect(flightPhase(state({ onGround: true, latitude: null }))).toBe('on-ground');
        expect(flightPhase(state({ latitude: null }))).toBe('no-position');
        expect(flightPhase(state({ longitude: null }))).toBe('no-position');
    });

    it('formats the altitude in feet and the speed in km/h, or a dash', () => {
        expect(formatAltitude(10000)).toBe('32,808 ft');
        expect(formatAltitude(null)).toBe('—');
        expect(formatSpeed(850.4)).toBe('850 km/h');
        expect(formatSpeed(null)).toBe('—');
    });

    it('puts the plane on the arc by the leg times, clamped, and by phase without them', () => {
        const dep = '2026-11-05T11:04:00.000Z';
        const arr = '2026-11-05T14:13:00.000Z';
        const t0 = Date.parse(dep);
        expect(legProgress(state({ departureAt: dep, arrivalAt: arr }), t0)).toBe(0);
        expect(legProgress(state({ departureAt: dep, arrivalAt: arr }), Date.parse(arr))).toBe(1);
        expect(
            legProgress(
                state({ departureAt: dep, arrivalAt: arr }),
                t0 + (Date.parse(arr) - t0) / 2
            )
        ).toBe(0.5);
        // Past the arrival: still 1.
        expect(
            legProgress(state({ departureAt: dep, arrivalAt: arr }), Date.parse(arr) + 60_000)
        ).toBe(1);
        // A zero-length leg falls back to the phase.
        expect(legProgress(state({ departureAt: dep, arrivalAt: dep }), t0)).toBe(0.5);
        // Without times: parked at the start, airborne halfway.
        expect(legProgress(state({ onGround: true }), t0)).toBe(0);
        expect(legProgress(state({ onGround: false }), t0)).toBe(0.5);
        // Only one time known: same fallback.
        expect(legProgress(state({ departureAt: dep }), t0)).toBe(0.5);
    });
});

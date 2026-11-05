import { describe, expect, it } from 'vite-plus/test';
import {
    parseCity,
    parseCoordinates,
    parseFlights,
    parseKeyInput,
    parsePlaceQuery,
    parseProviderId,
    parseSymbols
} from '../../src/main/validate';

describe('the IPC argument validation', () => {
    it('trims a city', () => {
        expect(parseCity('  Rome ')).toBe('Rome');
    });

    it.each([
        ['a number', 42, /must be a string/],
        ['an empty string', '   ', /1 to 100 characters/],
        ['a long string', 'x'.repeat(101), /1 to 100 characters/]
    ])('refuses %s as a city', (_name, city, error) => {
        expect(() => parseCity(city)).toThrow(error);
        expect(() => parsePlaceQuery({ city })).toThrow(error);
    });

    it('accepts a city or coordinates on the globe', () => {
        expect(parsePlaceQuery({ city: ' Oslo' })).toEqual({ city: 'Oslo' });
        expect(parsePlaceQuery({ latitude: -90, longitude: 180, extra: true })).toEqual({
            latitude: -90,
            longitude: 180
        });
    });

    it.each([
        ['nothing', undefined, /city or coordinates/],
        ['null', null, /city or coordinates/],
        ['a string', 'Rome', /city or coordinates/],
        ['missing coordinates', {}, /out of range/],
        ['a latitude past the pole', { latitude: 90.5, longitude: 0 }, /out of range/],
        ['a longitude past the date line', { latitude: 0, longitude: -181 }, /out of range/],
        ['a non-finite coordinate', { latitude: NaN, longitude: 0 }, /out of range/],
        ['string coordinates', { latitude: '1', longitude: '2' }, /out of range/]
    ])('refuses %s as a place', (_name, place, error) => {
        expect(() => parsePlaceQuery(place)).toThrow(error);
        expect(() => parseCoordinates(place)).toThrow(error);
    });

    it('takes the surf spot as coordinates only, never as a city', () => {
        expect(parseCoordinates({ latitude: 38.99, longitude: -9.42 })).toEqual({
            latitude: 38.99,
            longitude: -9.42
        });
        expect(() => parseCoordinates({ city: 'Ericeira' })).toThrow(/out of range/);
    });
});

describe('the provider key validation', () => {
    it('accepts a provider of the manifest', () => {
        expect(parseProviderId('finnhub')).toBe('finnhub');
    });

    it('refuses anything that is not a provider', () => {
        expect(() => parseProviderId('openweather')).toThrow(/Unknown provider/);
        expect(() => parseProviderId(42)).toThrow(/Unknown provider/);
    });

    it('accepts a trimmed key', () => {
        expect(parseKeyInput('  c0ffee  ')).toBe('c0ffee');
    });

    it.each([
        ['a number', 42, /must be a string/],
        ['an empty string', '   ', /1 to 256 characters/],
        ['a long string', 'x'.repeat(257), /1 to 256 characters/]
    ])('refuses %s as a key', (_name, key, error) => {
        expect(() => parseKeyInput(key)).toThrow(error);
    });
});

describe('the symbols validation', () => {
    it('accepts, uppercases and dedupes tickers', () => {
        expect(parseSymbols(['aapl', 'NVDA', 'AAPL'])).toEqual(['AAPL', 'NVDA']);
    });

    it.each([
        ['nothing', undefined, /a list of/],
        ['a string', 'AAPL', /a list of/],
        ['an empty list', [], /a list of/],
        ['too many tickers', ['A', 'B', 'C', 'D', 'E', 'F'], /a list of/],
        ['a non-string entry', ['AAPL', 42], /a list of/]
    ])('refuses %s', (_name, symbols, error) => {
        expect(() => parseSymbols(symbols)).toThrow(error);
    });

    it('refuses a ticker of the wrong shape', () => {
        expect(() => parseSymbols(['aapl-x!'])).toThrow(/at most 12/);
        expect(() => parseSymbols([''])).toThrow(/at most 12/);
    });
});

describe('the flights validation', () => {
    it('accepts, normalizes and dedupes flight numbers', () => {
        expect(parseFlights(['lh-123', 'BA456', 'lh123', 'TFL2DW', 'or1638'])).toEqual([
            'LH123',
            'BA456',
            'TFL2DW',
            'OR1638'
        ]);
    });

    it.each([
        ['nothing', undefined, /a list of/],
        ['a string', 'LH123', /a list of/],
        ['an empty list', [], /a list of/],
        ['too many flights', ['LH1', 'LH2', 'LH3', 'LH4', 'LH5', 'LH6'], /a list of/],
        ['a non-string entry', ['LH123', 42], /a list of/]
    ])('refuses %s', (_name, flights, error) => {
        expect(() => parseFlights(flights)).toThrow(error);
    });

    it('refuses a flight number of the wrong shape', () => {
        expect(() => parseFlights(['AAPL'])).toThrow(/flight number/);
        expect(() => parseFlights(['???'])).toThrow(/flight number/);
    });
});

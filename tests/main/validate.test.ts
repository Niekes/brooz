import { describe, expect, it } from 'vite-plus/test';
import { parseCity, parsePlaceQuery } from '../../src/main/validate';

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
    });
});

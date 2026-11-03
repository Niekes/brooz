import { describe, expect, it } from 'vite-plus/test';
import type { SurfHourPart } from '../../src/shared/surf';
import { bestWindow, rateSurf, ratingValue, waveRangeM } from '../../src/shared/surf';

/** A 1.5 m wave, a 14 s period and 20 km/h of wind score 3+3+1 = 7: great. */
function hour(
    waveHeightM: number | null,
    swellPeriodS: number | null,
    windKmh: number | null
): SurfHourPart {
    return { waveHeightM, swellPeriodS, windKmh };
}

describe('the surf rating', () => {
    it('weighs a rating for averaging: poor 0 to great 3', () => {
        expect(ratingValue('poor')).toBe(0);
        expect(ratingValue('fair')).toBe(1);
        expect(ratingValue('good')).toBe(2);
        expect(ratingValue('great')).toBe(3);
    });

    it('calls a point without wave height poor: it is not on the water', () => {
        expect(rateSurf(hour(null, 15, 5))).toBe('poor');
    });

    it('scores the wave height against a fixed good swell: best at 1-2.5 m', () => {
        // base 14 s + 20 km/h scores 4, so the height decides the rating
        const at = (waveHeightM: number) => rateSurf(hour(waveHeightM, 14, 20));
        expect(at(0.4)).toBe('fair'); // 0 + 4
        expect(at(0.5)).toBe('good'); // 1 + 4
        expect(at(0.99)).toBe('good'); // 1 + 4
        expect(at(1)).toBe('great'); // 3 + 4
        expect(at(2.5)).toBe('great'); // 3 + 4
        expect(at(2.6)).toBe('good'); // huge is powerful but rough: 2 + 4
    });

    it('scores the swell period against a fixed good wave: a real swell has 10 s or more', () => {
        // base 1.5 m + no wind scores 4, so the period decides the rating
        const at = (swellPeriodS: number | null) => rateSurf(hour(1.5, swellPeriodS, null));
        expect(at(null)).toBe('fair'); // 3 + 0 + 1
        expect(at(6.9)).toBe('fair'); // 3 + 0 + 1
        expect(at(7)).toBe('good'); // 3 + 1 + 1
        expect(at(9.9)).toBe('good'); // 3 + 1 + 1
        expect(at(10)).toBe('good'); // 3 + 2 + 1
        expect(at(13.9)).toBe('good'); // 3 + 2 + 1
        expect(at(14)).toBe('great'); // 3 + 3 + 1
    });

    it('scores the wind against a fixed good wave: calm is best, above 25 km/h ruins the face', () => {
        // base 1.5 m + 14 s scores 6, so the wind decides the rating
        const at = (windKmh: number | null) => rateSurf(hour(1.5, 14, windKmh));
        expect(at(null)).toBe('great'); // 3 + 3 + 1
        expect(at(14.9)).toBe('great'); // 3 + 3 + 2
        expect(at(15)).toBe('great'); // 3 + 3 + 1
        expect(at(25)).toBe('great'); // 3 + 3 + 1
        expect(at(25.1)).toBe('good'); // 3 + 3 + 0
    });

    it('maps the points to the four ratings', () => {
        expect(rateSurf(hour(1.5, 15, 8))).toBe('great'); // 8
        expect(rateSurf(hour(1.5, 11, 20))).toBe('good'); // 6
        expect(rateSurf(hour(0.7, 11, 20))).toBe('fair'); // 4
        expect(rateSurf(hour(0.3, 5, 30))).toBe('poor'); // 0
    });
});

describe('the best-surf window', () => {
    it('is null without hours', () => {
        expect(bestWindow([], 4)).toBe(null);
    });

    it('is null when even the best window averages below fair', () => {
        expect(bestWindow([hour(0.3, 5, 30), hour(0.3, 5, 30), hour(0.3, 5, 30)], 2)).toBe(null);
    });

    it('takes the contiguous hours with the best average; ties go to the earliest', () => {
        // ratings: poor, fair, good, good, fair -> the middle pair wins
        const list = [
            hour(0.3, 5, 30),
            hour(0.7, 8, 20),
            hour(1.5, 11, 20),
            hour(2, 12, 20),
            hour(0.7, 8, 20)
        ];
        expect(bestWindow(list, 2)).toEqual({ start: 2, end: 4 });
    });

    it('shrinks to the hours there are', () => {
        expect(bestWindow([hour(1.5, 11, 10)], 4)).toEqual({ start: 0, end: 1 });
    });
});

describe('the wave range', () => {
    it('spans the smallest and biggest wave, ignoring missing ones', () => {
        expect(
            waveRangeM([hour(2, null, null), hour(null, null, null), hour(0.8, null, null)])
        ).toEqual({
            min: 0.8,
            max: 2
        });
    });

    it('is null when every hour misses the wave', () => {
        expect(waveRangeM([hour(null, null, null)])).toBe(null);
        expect(waveRangeM([])).toBe(null);
    });
});

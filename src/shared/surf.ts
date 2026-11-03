/**
 * The data the surf channel carries. The main process fetches it from
 * Stormglass for the surf spot, the surf tile renders it. Times are ISO
 * strings in UTC; the tile shows them in the spot's own time zone.
 */

/** One hour of the marine forecast. Stormglass has no value off the water: `null`. */
export interface SurfHour {
    time: string;
    waveHeightM: number | null;
    swellPeriodS: number | null;
    /** Where the swell comes from, in degrees. */
    swellDirection: number | null;
    windKmh: number | null;
    /** Where the wind comes from, in degrees. */
    windDirection: number | null;
    waterTemperatureC: number | null;
}

export interface TideExtreme {
    time: string;
    type: 'high' | 'low';
}

export interface SurfForecast {
    hours: SurfHour[];
    tides: TideExtreme[];
    /** When the swell was fetched: the forecast may be hours old to save the daily quota. */
    fetchedAt: string;
}

/**
 * The surf tile's verdict for an hour. Stormglass has no rating of its own,
 * so the tile computes one from wave height, swell period and wind speed.
 */
export type SurfRating = 'great' | 'good' | 'fair' | 'poor';

/** The fields the rating looks at. */
export type SurfHourPart = Pick<SurfHour, 'waveHeightM' | 'swellPeriodS' | 'windKmh'>;

/** The weight of a rating when windows are averaged: poor 0 to great 3. */
export function ratingValue(rating: SurfRating): number {
    return { poor: 0, fair: 1, good: 2, great: 3 }[rating];
}

/** Points for the wave height in meters: best at 1-2.5 m, less when smaller or huge. */
function heightPoints(waveHeightM: number): number {
    if (waveHeightM < 0.5) return 0;
    if (waveHeightM < 1) return 1;
    if (waveHeightM <= 2.5) return 3;
    return 2;
}

/** Points for the swell period in seconds: a real swell has 10 s or more. */
function periodPoints(swellPeriodS: number): number {
    if (swellPeriodS < 7) return 0;
    if (swellPeriodS < 10) return 1;
    if (swellPeriodS < 14) return 2;
    return 3;
}

/** Points for the wind in km/h: calm is best, above 25 km/h ruins the face. */
function windPoints(windKmh: number): number {
    if (windKmh < 15) return 2;
    if (windKmh <= 25) return 1;
    return 0;
}

/**
 * The rating of one hour, as points per signal added up: 7+ points are
 * great, 5-6 good, 3-4 fair, less poor. No wave height at all means the
 * point is not on the water: poor.
 */
export function rateSurf(hour: SurfHourPart): SurfRating {
    if (hour.waveHeightM === null) {
        return 'poor';
    }
    const total =
        heightPoints(hour.waveHeightM) +
        (hour.swellPeriodS === null ? 0 : periodPoints(hour.swellPeriodS)) +
        (hour.windKmh === null ? 1 : windPoints(hour.windKmh));
    if (total >= 7) return 'great';
    if (total >= 5) return 'good';
    if (total >= 3) return 'fair';
    return 'poor';
}

/** A window into an hour list: index `start` inclusive, `end` exclusive. */
export interface SurfWindow {
    start: number;
    end: number;
}

/**
 * The contiguous `size` hours with the best average rating - the tile's
 * best-surf window. Ties go to the earliest window. When even the best
 * window averages below fair, there is nothing worth calling best: `null`.
 */
export function bestWindow(hours: readonly SurfHourPart[], size: number): SurfWindow | null {
    const width = Math.min(size, hours.length);
    if (width === 0) {
        return null;
    }
    let best: SurfWindow | null = null;
    let bestAverage = 0;
    for (let start = 0; start + width <= hours.length; start++) {
        const slice = hours.slice(start, start + width);
        const average = slice.reduce((sum, hour) => sum + ratingValue(rateSurf(hour)), 0) / width;
        if (average > bestAverage) {
            bestAverage = average;
            best = { start, end: start + width };
        }
    }
    return bestAverage >= ratingValue('fair') ? best : null;
}

/** The smallest and biggest wave height of the hours, or `null` when all are missing. */
export function waveRangeM(hours: readonly SurfHourPart[]): { min: number; max: number } | null {
    const heights = hours.map((hour) => hour.waveHeightM).filter((h): h is number => h !== null);
    return heights.length === 0 ? null : { min: Math.min(...heights), max: Math.max(...heights) };
}

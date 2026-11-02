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

/**
 * The data the weather channels carry. The main process fetches it from
 * Open-Meteo, the live tiles render it; both sides import these types and
 * the cache key of a place from here.
 */

export interface GeoPlace {
    name: string;
    country?: string;
    countryCode?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone: string;
}

/** Raw coordinates skip geocoding entirely. */
export interface Coordinates {
    latitude: number;
    longitude: number;
}

/** A named city or raw coordinates. */
export type PlaceQuery = { city: string } | Coordinates;

/** A cache key for a place, without resolving it first. */
export function placeKey(query: PlaceQuery): string {
    return 'city' in query
        ? `city:${query.city.trim().toLowerCase()}`
        : `geo:${query.latitude.toFixed(3)},${query.longitude.toFixed(3)}`;
}

export interface WeatherDay {
    date: string;
    code: number;
    minC: number;
    maxC: number;
    precipitationProbability: number;
}

export interface WeatherSnapshot {
    place: GeoPlace;
    temperatureC: number;
    apparentC: number;
    humidity: number;
    windKmh: number;
    code: number;
    isDay: boolean;
    observedAt: string;
    timezoneAbbreviation: string;
    daily: WeatherDay[];
}

export interface AirQualitySnapshot {
    place: GeoPlace;
    aqi: number;
    pm25: number;
    pm10: number;
    observedAt: string;
}

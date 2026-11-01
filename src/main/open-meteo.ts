import type { GeoPlace, PlaceQuery } from '../shared/weather';
import { createCache, fetchJson } from './http';

/**
 * Open-Meteo's geocoder: keyless, and the one source of a place's IANA time
 * zone, which the world clock needs and OpenWeatherMap does not give
 * (`docs/adr/0003-openweathermap-replaces-open-meteo.md`). Places are cached
 * for an hour.
 */

interface GeocodeRaw {
    results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        country?: string;
        country_code?: string;
        admin1?: string;
        timezone?: string;
    }>;
}

const cache = createCache(1000 * 60 * 60);

export async function geocodeCity(city: string): Promise<GeoPlace> {
    const cacheKey = city.trim().toLowerCase();
    const cached = cache.read<GeoPlace>(cacheKey);
    if (cached) {
        return cached;
    }

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', city.trim());
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const result = (await fetchJson<GeocodeRaw>(url, 'The place search')).results?.[0];
    if (!result) {
        throw new Error(`I couldn't find “${city.trim()}”. Try another city.`);
    }

    return cache.write(cacheKey, {
        name: result.name,
        country: result.country,
        countryCode: result.country_code,
        admin1: result.admin1,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone ?? 'UTC'
    });
}

/**
 * Resolves a query to a place. Coordinates get a synthetic place named after
 * the device location, so the rest of the pipeline never has to branch.
 */
export function resolvePlace(query: PlaceQuery): Promise<GeoPlace> {
    if ('city' in query) {
        return geocodeCity(query.city);
    }
    return Promise.resolve({
        name: 'Your location',
        latitude: query.latitude,
        longitude: query.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    });
}

import { net } from 'electron';
import { placeKey } from '../shared/weather';
import type { AirQualitySnapshot, GeoPlace, PlaceQuery, WeatherSnapshot } from '../shared/weather';

/**
 * Open-Meteo is keyless, so the main process calls it directly and the
 * renderer's CSP keeps `connect-src 'self'`. Geocoding, forecasts and air
 * quality are cached in memory for a while: switching between live tiles
 * does not refetch the same city.
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

interface ForecastRaw {
    timezone_abbreviation: string;
    current: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        weather_code: number;
        wind_speed_10m: number;
        is_day: number;
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max?: number[];
    };
}

interface AirQualityRaw {
    current: {
        time: string;
        european_aqi: number | null;
        pm2_5: number | null;
        pm10: number | null;
    };
}

const GEOCODE_TTL = 1000 * 60 * 60;
const DATA_TTL = 1000 * 60 * 10;

const cache = new Map<string, { at: number; value: unknown }>();

function readCache<T>(key: string, ttl: number): T | undefined {
    const entry = cache.get(key);
    if (!entry) {
        return undefined;
    }
    if (Date.now() - entry.at > ttl) {
        cache.delete(key);
        return undefined;
    }
    return entry.value as T;
}

function writeCache<T>(key: string, value: T): T {
    cache.set(key, { at: Date.now(), value });
    return value;
}

async function fetchJson<T>(url: URL): Promise<T> {
    const response = await net.fetch(url.toString());
    if (!response.ok) {
        throw new Error(`The weather service replied with ${response.status}.`);
    }
    return (await response.json()) as T;
}

export async function geocodeCity(city: string): Promise<GeoPlace> {
    const cacheKey = `geocode:${city.trim().toLowerCase()}`;
    const cached = readCache<GeoPlace>(cacheKey, GEOCODE_TTL);
    if (cached) {
        return cached;
    }

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', city.trim());
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const result = (await fetchJson<GeocodeRaw>(url)).results?.[0];
    if (!result) {
        throw new Error(`I couldn't find “${city.trim()}”. Try another city.`);
    }

    return writeCache(cacheKey, {
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
function resolvePlace(query: PlaceQuery): Promise<GeoPlace> {
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

function placeUrl(base: string, place: GeoPlace, current: string): URL {
    const url = new URL(base);
    url.searchParams.set('latitude', String(place.latitude));
    url.searchParams.set('longitude', String(place.longitude));
    url.searchParams.set('current', current);
    url.searchParams.set('timezone', 'auto');
    return url;
}

export async function fetchWeather(query: PlaceQuery): Promise<WeatherSnapshot> {
    const cacheKey = `weather:${placeKey(query)}`;
    const cached = readCache<WeatherSnapshot>(cacheKey, DATA_TTL);
    if (cached) {
        return cached;
    }

    const place = await resolvePlace(query);
    const url = placeUrl(
        'https://api.open-meteo.com/v1/forecast',
        place,
        'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day'
    );
    url.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    );
    url.searchParams.set('forecast_days', '5');

    const raw = await fetchJson<ForecastRaw>(url);
    const { current, daily } = raw;

    return writeCache(cacheKey, {
        place,
        temperatureC: current.temperature_2m,
        apparentC: current.apparent_temperature,
        humidity: Math.round(current.relative_humidity_2m),
        windKmh: current.wind_speed_10m,
        code: current.weather_code,
        isDay: current.is_day === 1,
        observedAt: current.time.slice(11, 16),
        timezoneAbbreviation: raw.timezone_abbreviation,
        daily: daily.time.map((date, index) => ({
            date,
            code: daily.weather_code[index],
            minC: daily.temperature_2m_min[index],
            maxC: daily.temperature_2m_max[index],
            precipitationProbability: daily.precipitation_probability_max?.[index] ?? 0
        }))
    });
}

function tenths(value: number | null): number {
    return Math.round((value ?? 0) * 10) / 10;
}

export async function fetchAirQuality(query: PlaceQuery): Promise<AirQualitySnapshot> {
    const cacheKey = `air:${placeKey(query)}`;
    const cached = readCache<AirQualitySnapshot>(cacheKey, DATA_TTL);
    if (cached) {
        return cached;
    }

    const place = await resolvePlace(query);
    const url = placeUrl(
        'https://air-quality-api.open-meteo.com/v1/air-quality',
        place,
        'european_aqi,pm2_5,pm10'
    );
    const { current } = await fetchJson<AirQualityRaw>(url);

    return writeCache(cacheKey, {
        place,
        aqi: Math.round(current.european_aqi ?? 0),
        pm25: tenths(current.pm2_5),
        pm10: tenths(current.pm10),
        observedAt: current.time.slice(11, 16)
    });
}

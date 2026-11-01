import { placeKey } from '../shared/weather';
import type {
    AirQualitySnapshot,
    Coordinates,
    PlaceQuery,
    WeatherDay,
    WeatherSnapshot
} from '../shared/weather';
import type { ProviderOutcome, ProviderProbe } from '../shared/providers';
import { createCache, fetchJson } from './http';
import { resolvePlace } from './open-meteo';

/**
 * OpenWeatherMap, the provider of the weather tiles, on its free 2.5 API
 * (`docs/adr/0003-openweathermap-replaces-open-meteo.md`). The main process
 * calls it with the provider's key; the renderer never sees one. Its answers
 * are mapped onto the shared weather contract, so the tiles keep rendering
 * WMO codes and daily rows: times are read in the place's own time zone.
 */

interface Condition {
    id: number;
    icon: string;
}

interface CurrentRaw {
    dt: number;
    weather: Condition[];
    main: { temp: number; feels_like: number; humidity: number };
    wind: { speed: number };
}

interface ForecastRaw {
    list: Array<{
        dt: number;
        weather: Condition[];
        main: { temp_min: number; temp_max: number };
        pop: number;
    }>;
}

interface AirRaw {
    list: Array<{ dt: number; main: { aqi: number }; components: { pm2_5: number; pm10: number } }>;
}

const API = 'https://api.openweathermap.org/data/2.5/';
const SERVICE = 'OpenWeatherMap';
/** Where the settings' "test" call checks a key: Berlin. */
const PROBE_PLACE: Coordinates = { latitude: 52.52, longitude: 13.405 };

const cache = createCache(1000 * 60 * 10);

/** A new key answers 401 for up to two hours; that is the likely reason. */
function rejected(status: number): string {
    return status === 401
        ? "OpenWeatherMap doesn't accept this key yet. New keys can take up to two hours to activate."
        : `${SERVICE} replied with ${status}.`;
}

function request<T>(key: string, path: string, place: Coordinates): Promise<T> {
    const url = new URL(path, API);
    url.searchParams.set('lat', String(place.latitude));
    url.searchParams.set('lon', String(place.longitude));
    url.searchParams.set('units', 'metric');
    url.searchParams.set('appid', key);
    return fetchJson<T>(url, SERVICE, rejected);
}

function tenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/** An OpenWeatherMap condition id as the WMO code the tiles render. */
function wmoCode(id: number): number {
    if (id < 300) {
        return 95;
    }
    if (id < 400) {
        return 51;
    }
    if (id < 600) {
        return id >= 520 ? 80 : 61;
    }
    if (id < 700) {
        return id >= 620 ? 85 : 71;
    }
    if (id < 800) {
        return 45;
    }
    return Math.min(id - 800, 3);
}

function inZone(seconds: number, timeZone: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(seconds * 1000);
}

/** HH:MM in the place's zone. */
function clock(seconds: number, timeZone: string): string {
    return inZone(seconds, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** YYYY-MM-DD in the place's zone. */
function dateOf(seconds: number, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(seconds * 1000);
}

/**
 * The free API forecasts in 3-hour steps: a day is the steps of its date,
 * its condition the worst of them (a higher WMO code is rougher weather).
 */
function days(steps: ForecastRaw['list'], timeZone: string): WeatherDay[] {
    const byDate = new Map<string, WeatherDay>();
    for (const step of steps) {
        const date = dateOf(step.dt, timeZone);
        const code = wmoCode(step.weather[0].id);
        const chance = Math.round(step.pop * 100);
        const day = byDate.get(date);
        if (day) {
            day.code = Math.max(day.code, code);
            day.minC = Math.min(day.minC, step.main.temp_min);
            day.maxC = Math.max(day.maxC, step.main.temp_max);
            day.precipitationProbability = Math.max(day.precipitationProbability, chance);
        } else {
            byDate.set(date, {
                date,
                code,
                minC: step.main.temp_min,
                maxC: step.main.temp_max,
                precipitationProbability: chance
            });
        }
    }
    return [...byDate.values()].slice(0, 5);
}

/** Runs a call as a provider outcome: the data or the provider's error, never a throw. */
async function outcome<T>(load: () => Promise<T>): Promise<ProviderOutcome<T>> {
    try {
        return { status: 'ok', data: await load() };
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : `${SERVICE} could not be reached.`;
        return { status: 'provider-error', message };
    }
}

export function fetchWeather(
    key: string,
    query: PlaceQuery
): Promise<ProviderOutcome<WeatherSnapshot>> {
    return outcome(async () => {
        const cacheKey = `weather:${placeKey(query)}`;
        const cached = cache.read<WeatherSnapshot>(cacheKey);
        if (cached) {
            return cached;
        }
        const place = await resolvePlace(query);
        const [now, forecast] = await Promise.all([
            request<CurrentRaw>(key, 'weather', place),
            request<ForecastRaw>(key, 'forecast', place)
        ]);
        return cache.write(cacheKey, {
            place,
            temperatureC: now.main.temp,
            apparentC: now.main.feels_like,
            humidity: Math.round(now.main.humidity),
            windKmh: tenths(now.wind.speed * 3.6),
            code: wmoCode(now.weather[0].id),
            isDay: now.weather[0].icon.endsWith('d'),
            observedAt: clock(now.dt, place.timezone),
            timezoneAbbreviation: inZone(now.dt, place.timezone, { timeZoneName: 'short' })
                .split(' ')
                .pop()!,
            // The steps are all in the future: the current reading keeps today in the list.
            daily: days(
                [
                    {
                        dt: now.dt,
                        weather: now.weather,
                        main: { temp_min: now.main.temp, temp_max: now.main.temp },
                        pop: 0
                    },
                    ...forecast.list
                ],
                place.timezone
            )
        });
    });
}

export function fetchAirQuality(
    key: string,
    query: PlaceQuery
): Promise<ProviderOutcome<AirQualitySnapshot>> {
    return outcome(async () => {
        const cacheKey = `air:${placeKey(query)}`;
        const cached = cache.read<AirQualitySnapshot>(cacheKey);
        if (cached) {
            return cached;
        }
        const place = await resolvePlace(query);
        const [reading] = (await request<AirRaw>(key, 'air_pollution', place)).list;
        return cache.write(cacheKey, {
            place,
            // The tile reads the index as one of five bands.
            aqi: Math.min(5, Math.max(1, Math.round(reading.main.aqi))),
            pm25: tenths(reading.components.pm2_5),
            pm10: tenths(reading.components.pm10),
            observedAt: clock(reading.dt, place.timezone)
        });
    });
}

/** Checks a key against the service with the current weather of one place. */
export async function probeKey(key: string): Promise<ProviderProbe> {
    const result = await outcome(() => request<CurrentRaw>(key, 'weather', PROBE_PLACE));
    return result.status === 'ok' ? { status: 'ok' } : result;
}

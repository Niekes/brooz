import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { ProviderOutcome, ProviderProbe } from '../shared/providers';
import type { SurfForecast, SurfHour, TideExtreme } from '../shared/surf';
import { placeKey } from '../shared/weather';
import type { Coordinates } from '../shared/weather';
import { fetchJson, outcome } from './http';

/**
 * Stormglass, the provider of the surf tile. Its free plan allows ten
 * requests a day per key, so every answer is kept on disk under `userData`
 * and spent sparingly: the swell once per four hours, the tides once per UTC
 * day. Once the quota is used up, the last forecast is served until the next
 * UTC day (`docs/adr/0007-stormglass-requests-are-budgeted-and-cached-on-disk.md`).
 * The key goes in a header and never into the cache file: an entry knows
 * its key by a short hash only, so a rotated key misses the cache.
 */

interface Meta {
    dailyQuota: number;
    requestCount: number;
}

type RawHour = { time: string } & Record<string, { sg?: number } | string>;

interface WeatherRaw {
    hours: RawHour[];
    meta: Meta;
}

interface TideRaw {
    data: Array<{ time: string; type: 'high' | 'low' }>;
    meta: Meta;
}

interface Entry<T> {
    spot: Coordinates;
    key: string;
    at: number;
    data: T;
}

interface Store {
    swell?: Entry<SurfHour[]>;
    tides?: Entry<TideExtreme[]>;
    /** The key whose quota ran out, and the UTC day it did. */
    spent?: { key: string; day: string };
}

const API = 'https://api.stormglass.io/v2/';
const SERVICE = 'Stormglass';
const CACHE_FILE = 'stormglass-cache.json';
const SWELL_TTL = 4 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const QUOTA_SPENT = "Stormglass's daily quota is used up. The forecast returns tomorrow.";
const PARAMS = [
    'waveHeight',
    'swellPeriod',
    'swellDirection',
    'windSpeed',
    'windDirection',
    'waterTemperature'
];

let store: Store | null = null;

function cachePath(): string {
    return join(app.getPath('userData'), CACHE_FILE);
}

/** Whether a spot has the coordinates `placeKey` relies on. */
function hasCoords(spot: unknown): boolean {
    if (typeof spot !== 'object' || spot === null) {
        return false;
    }
    const { latitude, longitude } = spot as Record<string, unknown>;
    return typeof latitude === 'number' && typeof longitude === 'number';
}

/** Whether a cache entry has the shape `through` and `fetchSurf` rely on. */
function isEntry(value: unknown): value is Entry<unknown> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const { spot, key, at, data } = value as Record<string, unknown>;
    return (
        hasCoords(spot) && typeof key === 'string' && typeof at === 'number' && Array.isArray(data)
    );
}

/** Whether a spent mark has the shape `isSpent` relies on. */
function isSpentMark(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const { key, day } = value as Record<string, unknown>;
    return typeof key === 'string' && typeof day === 'string';
}

/** Whether parsed cache JSON has the expected shape; anything else starts empty. */
function isStore(value: unknown): value is Store {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const { swell, tides, spent } = value as Record<string, unknown>;
    return (
        (swell === undefined || isEntry(swell)) &&
        (tides === undefined || isEntry(tides)) &&
        (spent === undefined || isSpentMark(spent))
    );
}

/** Loads the cache once per session; a missing, corrupt or wrong-shaped file starts empty. */
function load(): Store {
    if (store === null) {
        try {
            const parsed: unknown = JSON.parse(readFileSync(cachePath(), 'utf8'));
            store = isStore(parsed) ? parsed : {};
        } catch {
            store = {};
        }
    }
    return store;
}

function persist(): void {
    writeFileSync(cachePath(), JSON.stringify(store));
}

function hashOf(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function utcDay(time: number): string {
    return new Date(time).toISOString().slice(0, 10);
}

function rejected(status: number): string {
    if (status === 402) {
        return QUOTA_SPENT;
    }
    return status === 401 || status === 403
        ? "Stormglass doesn't accept this key."
        : `${SERVICE} replied with ${status}.`;
}

/** Marks the key's quota spent for the rest of the UTC day. */
function markSpent(hashed: string): void {
    load().spent = { key: hashed, day: utcDay(Date.now()) };
    persist();
}

function isSpent(hashed: string): boolean {
    const { spent } = load();
    return spent?.key === hashed && spent.day === utcDay(Date.now());
}

async function request<T extends { meta: Meta }>(
    key: string,
    path: string,
    spot: Coordinates,
    params: Record<string, string>
): Promise<T> {
    const url = new URL(path, API);
    url.searchParams.set('lat', String(spot.latitude));
    url.searchParams.set('lng', String(spot.longitude));
    for (const [name, value] of Object.entries(params)) {
        url.searchParams.set(name, value);
    }
    const hashed = hashOf(key);
    const raw = await fetchJson<T>(url, SERVICE, rejected, { Authorization: key }).catch(
        (cause: unknown) => {
            if (cause instanceof Error && cause.message === QUOTA_SPENT) {
                markSpent(hashed);
            }
            throw cause;
        }
    );
    if (raw.meta.requestCount >= raw.meta.dailyQuota) {
        markSpent(hashed);
    }
    return raw;
}

type Slot = 'swell' | 'tides';
type SlotEntry<S extends Slot> = NonNullable<Store[S]>;

const running = new Map<string, Promise<unknown>>();

/** One request per job at a time: a second caller waits for the first one's answer. */
function once<T>(id: string, start: () => Promise<T>): Promise<T> {
    let pending = running.get(id) as Promise<T> | undefined;
    if (!pending) {
        pending = start().finally(() => running.delete(id));
        running.set(id, pending);
    }
    return pending;
}

/** A new entry for the slot, or nothing when the quota ran out on the way. */
async function fetchEntry<S extends Slot>(
    slot: S,
    hashed: string,
    spot: Coordinates,
    fetchData: () => Promise<SlotEntry<S>['data']>
): Promise<SlotEntry<S> | undefined> {
    try {
        const next = { spot, key: hashed, at: Date.now(), data: await fetchData() };
        load()[slot] = next as Store[S];
        persist();
        return next as SlotEntry<S>;
    } catch (cause) {
        if (!isSpent(hashed)) {
            throw cause;
        }
        return undefined;
    }
}

/**
 * The cached entry of a slot while it is fresh, else a new one. With the
 * quota spent, the last entry of the spot is served at any age.
 */
async function through<S extends Slot>(
    slot: S,
    key: string,
    spot: Coordinates,
    fresh: (at: number) => boolean,
    fetchData: () => Promise<SlotEntry<S>['data']>
): Promise<SlotEntry<S>> {
    const hashed = hashOf(key);
    const entry = load()[slot];
    const mine = entry && placeKey(entry.spot) === placeKey(spot) ? entry : undefined;
    if (mine?.key === hashed && fresh(mine.at)) {
        return mine as SlotEntry<S>;
    }
    const next = isSpent(hashed)
        ? undefined
        : await once(`${slot}:${placeKey(spot)}:${hashed}`, () =>
              fetchEntry(slot, hashed, spot, fetchData)
          );
    const served = next ?? mine;
    if (!served) {
        throw new Error(QUOTA_SPENT);
    }
    return served as SlotEntry<S>;
}

function value(hour: RawHour, param: string, scale = 1): number | null {
    const sg = (hour[param] as { sg?: number } | undefined)?.sg;
    return sg === undefined ? null : Math.round(sg * scale * 10) / 10;
}

async function swell(key: string, spot: Coordinates): Promise<SurfHour[]> {
    const now = Math.floor(Date.now() / 1000);
    const raw = await request<WeatherRaw>(key, 'weather/point', spot, {
        params: PARAMS.join(','),
        source: 'sg',
        start: String(now),
        end: String(now + DAY / 1000)
    });
    return raw.hours.map((hour) => {
        const direction = value(hour, 'swellDirection');
        return {
            time: hour.time,
            waveHeightM: value(hour, 'waveHeight'),
            swellPeriodS: value(hour, 'swellPeriod'),
            swellDirection: direction === null ? null : Math.round(direction),
            windKmh: value(hour, 'windSpeed', 3.6),
            windDirection: value(hour, 'windDirection'),
            waterTemperatureC: value(hour, 'waterTemperature')
        };
    });
}

/** The tide extremes from the start of today, UTC, for two days. */
async function tides(key: string, spot: Coordinates): Promise<TideExtreme[]> {
    const start = Date.parse(utcDay(Date.now())) / 1000;
    const raw = await request<TideRaw>(key, 'tide/extremes/point', spot, {
        start: String(start),
        end: String(start + (2 * DAY) / 1000)
    });
    return raw.data.map(({ time, type }) => ({ time, type }));
}

function sameDay(at: number): boolean {
    return utcDay(at) === utcDay(Date.now());
}

function tideEntry(key: string, spot: Coordinates): Promise<Entry<TideExtreme[]>> {
    return through('tides', key, spot, sameDay, () => tides(key, spot));
}

/** The surf forecast of the spot, or the provider's own error - never a throw. */
export function fetchSurf(key: string, spot: Coordinates): Promise<ProviderOutcome<SurfForecast>> {
    return outcome(SERVICE, async () => {
        const [hours, extremes] = await Promise.all([
            through(
                'swell',
                key,
                spot,
                (at) => Date.now() - at < SWELL_TTL,
                () => swell(key, spot)
            ),
            tideEntry(key, spot)
        ]);
        return {
            hours: hours.data,
            tides: extremes.data,
            fetchedAt: new Date(hours.at).toISOString()
        };
    });
}

/**
 * Checks a key with the tides of the last spot, and keeps them as the day's
 * tides: the test spends no request of its own.
 */
export async function probeKey(key: string): Promise<ProviderProbe> {
    const cache = load();
    const spot = cache.swell?.spot;
    if (spot === undefined) {
        return {
            status: 'provider-error',
            message: 'Open the surf forecast once, then test the key.'
        };
    }
    const result = await outcome(SERVICE, () => tideEntry(key, spot));
    return result.status === 'ok' ? { status: 'ok' } : result;
}

import { useGeolocation, useLocalStorage } from '@uidotdev/usehooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import { placeKey } from '../../../shared/weather';
import type {
    AirQualitySnapshot,
    GeoPlace,
    PlaceQuery,
    WeatherSnapshot
} from '../../../shared/weather';
import type { AsyncView } from './live';
import type { KeyStatus, ProviderInfo, ProviderOutcome } from '../../../shared/providers';
import type { StockQuote } from '../../../shared/quotes';

/** Where a live tile falls back when there is no device location for it. */
const FALLBACK_CITY = 'Berlin';

/**
 * Electron wraps an error thrown by an IPC handler as
 * "Error invoking remote method '<channel>': Error: <message>"; a tile shows
 * the message only.
 */
export function errorMessage(cause: unknown): string {
    if (!(cause instanceof Error)) {
        return 'Something went wrong while loading.';
    }
    return cause.message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '');
}

/**
 * Small effect-driven fetch state. The loader is held in a ref, so callers
 * can pass an inline closure without retriggering the request on every
 * render. An IPC call cannot be aborted, so a result that arrives after the
 * key changed is dropped instead.
 */
function useAsync<T>(key: string | null, loader: () => Promise<T>): AsyncView<T> {
    const loaderRef = useRef(loader);
    const [nonce, setNonce] = useState(0);
    const requestKey = key === null ? null : `${key}:${nonce}`;
    const [snapshot, setSnapshot] = useState<{
        key: string | null;
        data: T | null;
        error: string | null;
    }>({ key: null, data: null, error: null });

    useEffect(() => {
        loaderRef.current = loader;
    });

    useEffect(() => {
        if (requestKey === null) {
            return;
        }
        let stale = false;
        loaderRef.current().then(
            (data) => {
                if (!stale) {
                    setSnapshot({ key: requestKey, data, error: null });
                }
            },
            (cause: unknown) => {
                if (!stale) {
                    setSnapshot({ key: requestKey, data: null, error: errorMessage(cause) });
                }
            }
        );
        return () => {
            stale = true;
        };
    }, [requestKey]);

    const reload = useCallback(() => setNonce((value) => value + 1), []);
    const current = requestKey !== null && snapshot.key === requestKey;

    return {
        data: current ? snapshot.data : null,
        error: current ? snapshot.error : null,
        loading: requestKey !== null && !current,
        reload
    };
}

/** Where a tile shows live data: a place, or null while it is still unsettled. */
export interface LiveLocation {
    query: PlaceQuery | null;
    pending: boolean;
    /** The device location is unavailable, so the query is the fallback city. */
    fallback: boolean;
}

const GEO_OPTIONS: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 60_000
};

/** Two decimals, about a kilometre: a tile reloads when the device moves that far. */
function coarse(degrees: number): number {
    return Math.round(degrees * 100) / 100;
}

/** Whether tiles may follow the device location: on until the person turns it off. */
export function useDeviceLocationSetting(): [boolean, (on: boolean) => void] {
    return useLocalStorage<boolean>('brooz.location.enabled', true);
}

/** The fallback a tile shows when it may not, or cannot, follow the device. */
export const FALLBACK_LOCATION: LiveLocation = {
    query: { city: FALLBACK_CITY },
    pending: false,
    fallback: true
};

/**
 * The device location, followed while the tile is open. Without one (denied,
 * switched off, or unsupported) the tile falls back to Berlin and says so.
 */
export function useDeviceLocation(): LiveLocation {
    const { latitude, longitude, loading } = useGeolocation(GEO_OPTIONS);
    if (latitude !== null && longitude !== null) {
        return {
            query: { latitude: coarse(latitude), longitude: coarse(longitude) },
            pending: false,
            fallback: false
        };
    }
    if (loading) {
        return { query: null, pending: true, fallback: false };
    }
    return FALLBACK_LOCATION;
}

export function useWeather(query: PlaceQuery | null): AsyncView<ProviderOutcome<WeatherSnapshot>> {
    return useAsync(query && `weather:${placeKey(query)}`, () =>
        window.brooz.invoke(IPC_CHANNELS.weather, query!)
    );
}

export function useAirQuality(
    query: PlaceQuery | null
): AsyncView<ProviderOutcome<AirQualitySnapshot>> {
    return useAsync(query && `air:${placeKey(query)}`, () =>
        window.brooz.invoke(IPC_CHANNELS.airQuality, query!)
    );
}

export function usePlace(city: string | undefined): AsyncView<GeoPlace> {
    return useAsync(city ? `place:${city}` : null, () =>
        window.brooz.invoke(IPC_CHANNELS.geocode, city!)
    );
}

/**
 * Live market quotes over the provider channel. The result is the provider
 * union, so the tile can answer a missing key with an invitation instead
 * of an error.
 */
export function useQuotes(symbols: string[] | null): AsyncView<ProviderOutcome<StockQuote[]>> {
    return useAsync(symbols && `quotes:${symbols.join(' ')}`, () =>
        window.brooz.invoke(IPC_CHANNELS.stockQuotes, symbols!)
    );
}

/** Whether a provider's key is stored, and whether this system can store keys. */
export function useKeyStatus(provider: ProviderInfo): AsyncView<KeyStatus> {
    return useAsync(`key-status:${provider.id}`, () =>
        window.brooz.invoke(IPC_CHANNELS.keyStatus, provider.id)
    );
}

/** The current time, refreshed every second. */
export function useNow(): Date {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return now;
}

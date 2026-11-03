import { useCallback, useEffect, useRef, useState } from 'react';
import { useGeolocation } from './browser';
import { useDefaultLocation, useDeviceLocationSetting, useTileLocation } from './stored';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { IpcChannel } from '../../../shared/ipc';
import { placeKey } from '../../../shared/weather';
import type { AirQualitySnapshot, GeoPlace, PlaceQuery } from '../../../shared/weather';
import type { AsyncView } from './live';
import type { KeyStatus, ProviderInfo, ProviderOutcome } from '../../../shared/providers';
import type { LiveLoader } from '../tile';

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

/**
 * Where a tile shows live data. No query and not pending: there is no
 * location at all, and the tile asks for one.
 */
export interface LiveLocation {
    query: PlaceQuery | null;
    pending: boolean;
    /** The name to show for the place; `null` keeps the one the service gives. */
    name: string | null;
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

/** No location at all: the tile asks for one instead of guessing. */
export const NO_LOCATION: LiveLocation = { query: null, pending: false, name: null };

/** The default location as a tile's location: its coordinates, under its saved name. */
export function savedLocation(place: GeoPlace | null): LiveLocation {
    return place
        ? {
              query: { latitude: place.latitude, longitude: place.longitude },
              pending: false,
              name: place.name
          }
        : NO_LOCATION;
}

/**
 * The device location, followed while the tile is open. Without one (denied
 * or unsupported) the tile shows the fallback it is given. Disabled, the
 * position is never asked for.
 */
export function useDeviceLocation(fallback: LiveLocation, enabled = true): LiveLocation {
    const { latitude, longitude, loading } = useGeolocation(GEO_OPTIONS, enabled);
    if (latitude !== null && longitude !== null) {
        return {
            query: { latitude: coarse(latitude), longitude: coarse(longitude) },
            pending: false,
            name: null
        };
    }
    if (loading) {
        return { query: null, pending: true, name: null };
    }
    return fallback;
}

/**
 * Where a live tile shows its data: the city of the utterance, else the
 * tile's own location, else the device location while the person allows it,
 * else the default location under its saved name (docs/adr/0014). Without
 * any, the tile asks for a location.
 */
export function useLiveLocation(city: string | undefined, tileId: string): LiveLocation {
    const [followDevice] = useDeviceLocationSetting();
    const [place] = useDefaultLocation();
    const [tilePlace] = useTileLocation(tileId);
    const fallback = savedLocation(place);
    const device = useDeviceLocation(fallback, !city && !tilePlace && followDevice);
    if (city) {
        return { query: { city }, pending: false, name: null };
    }
    if (tilePlace) {
        return savedLocation(tilePlace);
    }
    return followDevice ? device : fallback;
}

export function useAirQuality(
    query: PlaceQuery | null
): AsyncView<ProviderOutcome<AirQualitySnapshot>> {
    return useAsync(query && `air:${placeKey(query)}`, () =>
        window.brooz.invoke(IPC_CHANNELS.airQuality, query!)
    );
}

/**
 * Invokes a provider channel chosen at runtime; the contract's per-channel
 * argument types only exist per literal channel, so the shell passes them
 * as the union here and the main process validates them.
 */
function invokeChannel(channel: IpcChannel, args: readonly unknown[]): Promise<unknown> {
    return (window.brooz.invoke as (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>)(
        channel,
        ...args
    );
}

/**
 * Loads a provider channel's outcome, the way every provider tile loads:
 * `key` is null while no request can be made, and the tile builds it from
 * its args, so an arg change reloads. The result is the provider union, so
 * the shell can answer a missing key with an invitation instead of an error.
 */
export function useProviderData<T>(
    channel: IpcChannel,
    key: string | null,
    args: readonly unknown[]
): AsyncView<ProviderOutcome<T>> {
    return useAsync(key === null ? null : `${channel}:${key}`, () =>
        invokeChannel(channel, args).then((result) => result as ProviderOutcome<T>)
    );
}

/**
 * The loader of a place-based live tile: the location of the utterance's
 * city, the device location or the default location, loaded over the chosen
 * provider's channel. The saved name of the default location replaces the
 * one the service gives. Without any location, no request is made and the
 * tile asks for one.
 */
export function usePlaceData<T extends { place: GeoPlace }>(
    city: string | undefined,
    channel: IpcChannel,
    tileId: string
): LiveLoader<T> {
    const location = useLiveLocation(city, tileId);
    const state = useProviderData<T>(channel, location.query ? placeKey(location.query) : null, [
        location.query
    ]);
    const named =
        state.data?.status === 'ok' && location.name !== null
            ? {
                  ...state.data,
                  data: {
                      ...state.data.data,
                      place: { ...state.data.data.place, name: location.name }
                  }
              }
            : state.data;
    return {
        pending: location.pending,
        notice: !location.query && !location.pending ? 'Set a location first.' : null,
        state: { ...state, data: named }
    };
}

/** Whether a provider's key is stored, and whether this system can store keys. */
export function useKeyStatus(provider: ProviderInfo): AsyncView<KeyStatus> {
    return useAsync(`key-status:${provider.id}`, () =>
        window.brooz.invoke(IPC_CHANNELS.keyStatus, provider.id)
    );
}

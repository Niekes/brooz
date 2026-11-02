import { useLocalStorageState } from 'ahooks';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The browser APIs ahooks has no hook for, and the one storage hook every
 * stored value goes through (docs/adr/0007-ahooks-replaces-usehooks.md).
 * This module is the only renderer code that touches them directly.
 */

/**
 * A value kept in localStorage as JSON. Every component that reads the key
 * follows a write from any other one, so a change in the settings reaches
 * each open tile at once.
 */
export function useStoredValue<T>(key: string, initial: T): [T, (value: T) => void] {
    const [value, setValue] = useLocalStorageState<T>(key, {
        defaultValue: initial,
        listenStorageChange: true
    });
    return [value as T, setValue];
}

/** Whether the media query matches, followed as it changes. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query]
    );
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** The device position; `null` coordinates once it is denied or unavailable. */
export interface DevicePosition {
    latitude: number | null;
    longitude: number | null;
    loading: boolean;
}

/** The device position, watched while the component is mounted. */
export function useGeolocation(options: PositionOptions): DevicePosition {
    const [position, setPosition] = useState<DevicePosition>({
        latitude: null,
        longitude: null,
        loading: true
    });
    useEffect(() => {
        const id = navigator.geolocation.watchPosition(
            ({ coords }) =>
                setPosition({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    loading: false
                }),
            () => setPosition((current) => ({ ...current, loading: false })),
            options
        );
        return () => navigator.geolocation.clearWatch(id);
    }, [options]);
    return position;
}

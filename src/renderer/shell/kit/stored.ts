import { useStoredValue } from './browser';
import type { GeoPlace } from '../../../shared/weather';
import type { TileDefinition, TileProvider } from '../tile';
import type { TemperatureUnit } from './weather';

/**
 * The stored settings: every value kept in localStorage goes through
 * `useStoredValue`, so a write in the settings reaches every open tile
 * (docs/adr/0008). This module owns the person's and the tiles' stored
 * choices; `hooks.ts` owns the data loading.
 */

/** Whether tiles may follow the device location: on until the person turns it off. */
export function useDeviceLocationSetting(): [boolean, (on: boolean) => void] {
    return useStoredValue<boolean>('brooz.location.enabled', true);
}

/** The default location the person saved in the settings, or `null`; every tile follows a change. */
export function useDefaultLocation(): [GeoPlace | null, (place: GeoPlace | null) => void] {
    return useStoredValue<GeoPlace | null>('brooz.location.default', null);
}

/** The location a tile saved for itself in its settings section, or `null` (docs/adr/0014). */
export function useTileLocation(
    tileId: string
): [GeoPlace | null, (place: GeoPlace | null) => void] {
    return useStoredValue<GeoPlace | null>(`brooz.tile.${tileId}.location`, null);
}

/**
 * The surf spot the person saved in the settings, or `null`: a place on the
 * water, not a location, so no city and no device location replace it.
 */
export function useSurfSpot(): [GeoPlace | null, (spot: GeoPlace | null) => void] {
    return useStoredValue<GeoPlace | null>('brooz.surf.spot', null);
}

/** The temperature unit: Celsius until the person picks Fahrenheit. */
export function useTemperatureUnit(): [TemperatureUnit, (unit: TemperatureUnit) => void] {
    const [unit, setUnit] = useStoredValue<TemperatureUnit>('brooz.temperature.unit', 'C');
    // The stored value is untyped JSON: anything but 'F' reads as Celsius.
    return [unit === 'F' ? 'F' : 'C', setUnit];
}

/** The storage key of a tile's chosen provider. */
export function chosenProviderKey(tileId: string): string {
    return `brooz.tile.${tileId}.provider`;
}

/**
 * The provider a live tile is served by: the stored choice while it is still
 * one of the tile's candidates, the first candidate otherwise.
 */
export function useChosenProvider(tile: TileDefinition): TileProvider | undefined {
    const candidates = tile.providers ?? [];
    const [stored] = useStoredValue<string | null>(chosenProviderKey(tile.id), null);
    return candidates.find((candidate) => candidate.provider.id === stored) ?? candidates[0];
}

/** The storage key of the start tile; About until the person picks another. */
export const START_TILE_KEY = 'brooz.start.tile';

/** The tile the dashboard centers on at launch (docs/adr/0015). */
export function useStartTile(): [string, (id: string) => void] {
    return useStoredValue<string>(START_TILE_KEY, 'about');
}

import type { JSX, ReactNode } from 'react';
import { OPENWEATHERMAP } from '../../../shared/providers';
import type { ProviderOutcome } from '../../../shared/providers';
import type {
    AirQualitySnapshot,
    GeoPlace,
    PlaceQuery,
    WeatherSnapshot
} from '../../../shared/weather';
import {
    FALLBACK_LOCATION,
    useAirQuality,
    useDeviceLocation,
    useDeviceLocationSetting,
    useWeather
} from './hooks';
import type { LiveLocation } from './hooks';
import type { AsyncView } from './live';
import { ProviderData } from './live';

/**
 * The live frames of the weather tiles. They show a place: the city of the
 * utterance, or the device location, or Berlin, marked as such. They load, fail, retry and
 * ask for an OpenWeatherMap key like every provider tile, and name the
 * place once the data is there. The provider lives here, so a weather tile
 * only names its frame.
 */

/** The providers of every tile built on these frames, for its settings section. */
export const WEATHER_PROVIDERS = [OPENWEATHERMAP] as const;

export interface FrameProps<T> {
    label: string;
    lowConfidence: boolean;
    city: string | undefined;
    children: (data: T) => ReactNode;
}

type PlaceLoader<T> = (query: PlaceQuery | null) => AsyncView<ProviderOutcome<T>>;

interface PlaceFrameProps<T> extends Omit<FrameProps<T>, 'city'> {
    useData: PlaceLoader<T>;
}

function PlaceFrame<T extends { place: GeoPlace }>({
    label,
    lowConfidence,
    location,
    useData,
    children
}: PlaceFrameProps<T> & { location: LiveLocation }): JSX.Element {
    return (
        <ProviderData
            label={label}
            lowConfidence={lowConfidence}
            provider={OPENWEATHERMAP}
            pending={location.pending}
            state={useData(location.query)}
            meta={(data) =>
                location.fallback ? `${data.place.name} · location unavailable` : data.place.name
            }
        >
            {children}
        </ProviderData>
    );
}

/** Only a tile without a city follows the device, so a named city never asks for it. */
function DeviceFrame<T extends { place: GeoPlace }>(props: PlaceFrameProps<T>): JSX.Element {
    return <PlaceFrame {...props} location={useDeviceLocation()} />;
}

function LocatedFrame<T extends { place: GeoPlace }>({
    city,
    ...props
}: FrameProps<T> & { useData: PlaceLoader<T> }): JSX.Element {
    const [followDevice] = useDeviceLocationSetting();
    if (!city && followDevice) {
        return <DeviceFrame {...props} />;
    }
    if (!city) {
        return <PlaceFrame {...props} location={FALLBACK_LOCATION} />;
    }
    return (
        <PlaceFrame {...props} location={{ query: { city }, pending: false, fallback: false }} />
    );
}

/** The current weather and the forecast of a place. */
export function LiveWeatherFrame(props: FrameProps<WeatherSnapshot>): JSX.Element {
    return <LocatedFrame {...props} useData={useWeather} />;
}

/** The air quality of a place. */
export function LiveAirFrame(props: FrameProps<AirQualitySnapshot>): JSX.Element {
    return <LocatedFrame {...props} useData={useAirQuality} />;
}

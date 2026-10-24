import type { JSX, ReactNode } from 'react';
import type { WeatherSnapshot } from '../../../shared/weather';
import { useLiveLocation, useWeather } from './hooks';
import { LiveData } from './live';

/**
 * A live tile that shows the weather of a place: the city of the utterance,
 * or the device location, or Berlin. It loads, fails and retries like every
 * live tile, and names the place once the data is there.
 */
export function LiveWeatherFrame({
    label,
    lowConfidence,
    city,
    children
}: {
    label: string;
    lowConfidence: boolean;
    city: string | undefined;
    children: (data: WeatherSnapshot) => ReactNode;
}): JSX.Element {
    const { query, pending } = useLiveLocation(city);
    return (
        <LiveData
            label={label}
            lowConfidence={lowConfidence}
            pending={pending}
            state={useWeather(query)}
            meta={(data) => data.place.name}
        >
            {children}
        </LiveData>
    );
}

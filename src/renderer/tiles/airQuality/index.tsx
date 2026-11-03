import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { IpcChannel } from '../../../shared/ipc';
import { OPENWEATHERMAP } from '../../../shared/providers';
import type { AirQualitySnapshot } from '../../../shared/weather';
import { AIR_BAND, airCategory } from '../../shell/kit/air';
import { Eyebrow, WIDGET_BODY } from '../../shell/kit/chrome';
import { usePlaceData } from '../../shell/kit/hooks';
import { pick, rng } from '../../shell/kit/seed';
import type {
    CommandArgs,
    LiveLoader,
    LiveTileProps,
    TileDefinition,
    TileProps
} from '../../shell/tile';

const CITIES = ['Berlin', 'Tokyo', 'Lisbon', 'Oslo', 'Cairo', 'Melbourne'];

export function AirQuality({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 37);
    const aqi = 1 + Math.floor(r() * 5);
    const category = airCategory(aqi);
    const pm25 = Math.round(aqi * 9 + r() * 8);
    const pm10 = Math.round(pm25 * 1.6 + r() * 6);

    return (
        <div className={WIDGET_BODY}>
            <div className="flex items-start justify-between gap-2">
                <Eyebrow>Air Quality</Eyebrow>
                <span className="truncate text-[10px] font-medium tracking-[0.16em] text-white/40 uppercase">
                    {pick(seed, CITIES)}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
                <div className="text-5xl leading-none font-light" style={{ color: category.color }}>
                    {aqi}
                </div>
                <div className="min-w-0 text-right">
                    <div className="text-[11px] font-medium tracking-[0.14em] text-white/75 uppercase">
                        {category.label}
                    </div>
                    <div className="text-[9px] tracking-[0.14em] text-white/35 uppercase">
                        OpenWeatherMap index
                    </div>
                </div>
            </div>

            <div className="relative flex h-4 items-center">
                <div className="h-1.5 w-full rounded-full" style={{ background: AIR_BAND }} />
                <span
                    className="absolute size-3.5 -translate-1/2 rounded-full border-2 border-white/90 bg-white/25 shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                    style={{ left: `${(aqi - 0.5) * 20}%` }}
                />
            </div>

            <div className="flex items-end justify-between font-mono text-[10px] text-white/45">
                <span>PM2.5 {pm25} µg/m³</span>
                <span>PM10 {pm10} µg/m³</span>
            </div>
        </div>
    );
}

/** Loads the air quality of the utterance's place over the chosen provider's channel. */
function useLiveAir(args: CommandArgs, channel: IpcChannel): LiveLoader<AirQualitySnapshot> {
    return usePlaceData<AirQualitySnapshot>(args.city, channel);
}

/** The current air quality of a city, or of the device location. */
export function LiveAirQuality({ data }: LiveTileProps<AirQualitySnapshot>): JSX.Element {
    const category = airCategory(data.aqi);
    return (
        <div className="flex h-full min-h-0 flex-col justify-between gap-2">
            <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
                <div
                    className="text-4xl leading-none font-light tracking-tight"
                    style={{ color: category.color }}
                >
                    {data.aqi}
                </div>
                <div className="min-w-0 text-right">
                    <div className="text-[10px] font-medium tracking-[0.16em] text-white/70 uppercase">
                        {category.label}
                    </div>
                    <div className="mt-0.5 text-[9px] text-white/30">OpenWeatherMap index</div>
                </div>
            </div>

            <div className="relative h-2">
                <div
                    className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                    style={{ background: AIR_BAND }}
                />
                <span
                    className="absolute top-1/2 size-2.5 -translate-1/2 rounded-full border border-white bg-white/20 shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                    style={{ left: `${(data.aqi - 0.5) * 20}%` }}
                />
            </div>

            <div className="flex items-end justify-between gap-2 font-mono text-[10px] text-white/45">
                <span>PM2.5 {data.pm25}</span>
                <span>PM10 {data.pm10}</span>
                <span className="truncate">updated {data.observedAt}</span>
            </div>
        </div>
    );
}

export const airQualityTile: TileDefinition<AirQualitySnapshot> = {
    id: 'air-quality',
    title: 'Air Quality',
    Component: AirQuality,
    Live: LiveAirQuality,
    providers: [{ provider: OPENWEATHERMAP, channel: IPC_CHANNELS.airQuality }],
    liveData: useLiveAir,
    liveKey: ({ city }) => `air-quality:${city ?? ''}`,
    route: {
        description: 'Air quality index and pollution levels for a city.',
        keywords: ['air quality', 'aqi', 'pollution', 'smog', 'air'],
        examples: ['air quality in Beijing', 'how polluted is the air in Delhi'],
        pattern: /\b(?:air quality|aqi|pollution|polluted|smog)\b/,
        weight: 3.5,
        args: ({ city }) => ({ city })
    }
};

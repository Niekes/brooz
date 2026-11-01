import type { JSX } from 'react';
import { Eyebrow, WIDGET_BODY } from '../../shell/kit/chrome';
import { pick, rng } from '../../shell/kit/seed';
import { LiveAirFrame, WEATHER_PROVIDERS } from '../../shell/kit/weather-frame';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const CITIES = ['Berlin', 'Tokyo', 'Lisbon', 'Oslo', 'Cairo', 'Melbourne'];

/** The category colors are the data scale itself: the band is the AQI spectrum. */
const US_BAND = 'linear-gradient(to right, #4ade80 0%, #facc15 33%, #fb923c 66%, #f87171 100%)';
const US_CATEGORIES = [
    { limit: 50, name: 'Good', color: '#4ade80' },
    { limit: 100, name: 'Moderate', color: '#facc15' },
    { limit: 150, name: 'Sensitive Groups', color: '#fb923c' },
    { limit: Infinity, name: 'Unhealthy', color: '#f87171' }
];

export function AirQuality({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 37);
    const aqi = 12 + Math.floor(r() * 170);
    const category = US_CATEGORIES.find((entry) => aqi <= entry.limit)!;
    const pm25 = Math.round(aqi * 0.42 + r() * 8);
    const o3 = Math.round(20 + r() * 60);

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
                        {category.name}
                    </div>
                    <div className="text-[9px] tracking-[0.14em] text-white/35 uppercase">
                        US EPA Index
                    </div>
                </div>
            </div>

            <div className="relative flex h-4 items-center">
                <div className="h-1.5 w-full rounded-full" style={{ background: US_BAND }} />
                <span
                    className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white/25 shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                    style={{ left: `${Math.min(100, (aqi / 200) * 100)}%` }}
                />
            </div>

            <div className="flex items-end justify-between font-mono text-[10px] text-white/45">
                <span>PM2.5 {pm25} µg/m³</span>
                <span>O₃ {o3} ppb</span>
            </div>
        </div>
    );
}

const OWM_BAND = 'linear-gradient(to right, #4ade80, #bef264, #facc15, #fb923c, #f87171)';

/** OpenWeatherMap's air quality index, 1 to 5, as it names its bands. */
const OWM_CATEGORIES = [
    { label: 'Good', color: '#4ade80' },
    { label: 'Fair', color: '#bef264' },
    { label: 'Moderate', color: '#facc15' },
    { label: 'Poor', color: '#fb923c' },
    { label: 'Very poor', color: '#f87171' }
];

/** The current air quality of a city, or of the device location. */
export function LiveAirQuality({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    return (
        <LiveAirFrame label={label} lowConfidence={lowConfidence} city={args.city}>
            {(data) => {
                const category = OWM_CATEGORIES[data.aqi - 1];
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
                                <div className="mt-0.5 text-[9px] text-white/30">
                                    OpenWeatherMap index
                                </div>
                            </div>
                        </div>

                        <div className="relative h-2">
                            <div
                                className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                                style={{ background: OWM_BAND }}
                            />
                            <span
                                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white/20 shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
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
            }}
        </LiveAirFrame>
    );
}

export const airQualityTile: TileDefinition = {
    id: 'air-quality',
    title: 'Air Quality',
    Component: AirQuality,
    Live: LiveAirQuality,
    providers: WEATHER_PROVIDERS,
    deviceLocation: true,
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

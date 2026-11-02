import type { JSX } from 'react';
import { Eyebrow, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveWeatherFrame, WEATHER_PROVIDERS } from '../../shell/kit/weather-frame';
import { ConditionIcon } from '../../shell/kit/icons';
import type { CondName } from '../../shell/kit/icons';
import { HUES, pick, rng } from '../../shell/kit/seed';
import { inUnit, weatherInfo, weatherTone } from '../../shell/kit/weather';
import { useTemperatureUnit } from '../../shell/kit/hooks';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const CITIES = ['Berlin', 'Tokyo', 'Reykjavík', 'Lisbon', 'Oslo', 'Cairo', 'Seattle', 'Melbourne'];

const CONDS: ReadonlyArray<{ label: string; name: CondName }> = [
    { label: 'Clear', name: 'sun' },
    { label: 'Cloudy', name: 'cloud' },
    { label: 'Showers', name: 'rain' },
    { label: 'Snow', name: 'snow' },
    { label: 'Storm', name: 'storm' }
];

/** Current conditions, fully seeded. The middle band turns into a row on landscape tiles. */
export function Weather({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 7);
    const cond = pick(seed + 3, CONDS);
    const hue = pick(seed, HUES);
    const temp = 12 + Math.floor(r() * 23);
    const hi = temp + 1 + Math.floor(r() * 3);
    const lo = temp - 3 - Math.floor(r() * 5);
    const feels = temp - 2 + Math.floor(r() * 4);
    const [unit] = useTemperatureUnit();

    return (
        <div className={WIDGET_BODY}>
            <div className="flex items-start justify-between gap-2">
                <Eyebrow>Weather</Eyebrow>
                <span className="truncate text-[10px] font-medium tracking-[0.16em] text-white/40 uppercase">
                    {pick(seed, CITIES)}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 @min-[300px]:flex-row @min-[300px]:justify-between @min-[300px]:gap-5">
                <div className="text-5xl leading-none font-light tracking-tight text-white">
                    {inUnit(temp, unit)}
                    <span className="text-2xl align-top text-white/50">°{unit}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                    <ConditionIcon name={cond.name} className={`h-12 w-12 ${hue.text}`} />
                    <span className="text-[10px] tracking-[0.18em] text-white/55 uppercase">
                        {cond.label}
                    </span>
                </div>
            </div>

            <div className="flex items-end justify-between gap-2 font-mono text-[11px]">
                <span className="text-white/70">
                    H {inUnit(hi, unit)}°{' '}
                    <span className="text-white/40">L {inUnit(lo, unit)}°</span>
                </span>
                <span className="text-white/40">FEELS {inUnit(feels, unit)}°</span>
            </div>
        </div>
    );
}

/** The current weather of a city, or of the device location. */
export function LiveWeather({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    const [unit] = useTemperatureUnit();
    return (
        <LiveWeatherFrame label={label} lowConfidence={lowConfidence} city={args.city}>
            {(data) => {
                const info = weatherInfo(data.code);
                return (
                    <div className="flex h-full min-h-0 flex-col justify-between gap-2">
                        <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-4xl leading-none font-light tracking-tight text-white">
                                    {inUnit(data.temperatureC, unit)}
                                    <span className="align-top text-xl text-white/45">°{unit}</span>
                                </div>
                                <div className="mt-1 truncate text-[9px] font-medium tracking-[0.16em] text-white/50 uppercase">
                                    {info.label}
                                </div>
                            </div>
                            <ConditionIcon
                                name={info.icon}
                                className={`h-14 w-14 shrink-0 ${weatherTone(info.icon)}`}
                            />
                        </div>

                        <div className="flex items-end justify-between gap-2 font-mono text-[10px] text-white/45">
                            <span>FEELS {inUnit(data.apparentC, unit)}°</span>
                            <span>HUM {data.humidity}%</span>
                            <span className="truncate">WIND {Math.round(data.windKmh)}</span>
                        </div>
                    </div>
                );
            }}
        </LiveWeatherFrame>
    );
}

export const weatherTile: TileDefinition = {
    id: 'weather',
    title: 'Weather',
    Component: Weather,
    Live: LiveWeather,
    providers: WEATHER_PROVIDERS,
    deviceLocation: true,
    temperatures: true,
    liveKey: ({ city }) => `weather:${city ?? ''}`,
    route: {
        description: 'Current weather conditions and temperature right now for a city.',
        keywords: ['weather', 'temperature', 'rain', 'sunny', 'hot', 'cold', 'windy'],
        examples: ['weather in Rome', 'is it raining in Seattle'],
        pattern:
            /\b(?:weather|temperature|raining|rainy|sunny|snowing|humid|wind|windy|hot|cold|warm)\b/,
        weight: 2.5,
        args: ({ city }) => ({ city })
    }
};

import type { JSX } from 'react';
import type { WeatherSnapshot } from '../../../shared/weather';
import { airCategory } from '../../shell/kit/air';
import type { AirCategory } from '../../shell/kit/air';
import { useAirQuality, useTemperatureUnit } from '../../shell/kit/hooks';
import { LiveWeatherFrame, WEATHER_PROVIDERS } from '../../shell/kit/weather-frame';
import { ConditionIcon } from '../../shell/kit/icons';
import type { CondName } from '../../shell/kit/icons';
import { pick, rng } from '../../shell/kit/seed';
import { inUnit, weatherInfo, weatherTone } from '../../shell/kit/weather';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const CITIES = ['Berlin', 'Tokyo', 'Reykjavík', 'Lisbon', 'Oslo', 'Cairo', 'Seattle', 'Melbourne'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CONDS: ReadonlyArray<{ label: string; name: CondName }> = [
    { label: 'Sunny', name: 'sun' },
    { label: 'Cloudy', name: 'cloud' },
    { label: 'Showers', name: 'rain' },
    { label: 'Snow', name: 'snow' },
    { label: 'Storm', name: 'storm' }
];

/** The accent block's fill, one per condition; the text on it stays black. */
const ACCENTS: Record<CondName, string> = {
    sun: 'bg-[#ffdb00]',
    cloud: 'bg-[#a5b4fc]',
    rain: 'bg-[#7dd3fc]',
    snow: 'bg-[#e2e8f0]',
    storm: 'bg-[#fda4af]'
};

interface WeatherDayRow {
    key: string;
    label: string;
    icon: CondName;
    lo: number;
    hi: number;
}

interface WeatherCardProps {
    label: string;
    icon: CondName;
    /** Temperatures in Celsius; the card shows them in the person's unit. */
    temp: number;
    place: string;
    days: readonly WeatherDayRow[];
    /** The air quality category right now; `null` hides the indicator. */
    air: AirCategory | null;
}

/** The air quality category as a dot and its word; the ring keeps the dot visible on every accent. */
function AirIndicator({ category }: { category: AirCategory }): JSX.Element {
    return (
        <span
            role="img"
            aria-label={`Air quality: ${category.label}`}
            className="flex shrink-0 items-center gap-1 text-xs font-medium"
        >
            <span
                className="h-2 w-2 rounded-full ring-1 ring-black/50"
                style={{ background: category.color }}
            />
            {category.label}
        </span>
    );
}

/** Now on a coloured block, the next five days in a list beside it. */
function WeatherCard({ label, icon, temp, place, days, air }: WeatherCardProps): JSX.Element {
    const [unit] = useTemperatureUnit();
    return (
        <div className="flex h-full w-full min-h-0 gap-2.5">
            <div
                className={`flex min-w-0 flex-[1.15] flex-col justify-between rounded-2xl px-3.5 py-3 text-black [text-shadow:none] ${ACCENTS[icon]}`}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <ConditionIcon name={icon} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
                    {air ? <AirIndicator category={air} /> : null}
                </div>
                <div className="text-5xl leading-none font-normal tracking-tight">
                    {inUnit(temp, unit)}°
                </div>
                <div className="truncate text-base leading-tight font-semibold">{place}</div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-around rounded-2xl border border-white/15 px-3 py-1.5">
                {days.map((day) => (
                    <div
                        key={day.key}
                        className="grid grid-cols-[1fr_auto_1.6rem_1.6rem] items-center gap-1.5 text-xs font-semibold"
                    >
                        <span className="truncate text-white/50">{day.label}</span>
                        <ConditionIcon
                            name={day.icon}
                            className={`h-4 w-4 ${weatherTone(day.icon)}`}
                        />
                        <span className="text-right text-white/30">{inUnit(day.lo, unit)}</span>
                        <span className="text-right text-white">{inUnit(day.hi, unit)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Current conditions and five days, fully seeded. */
export function Weather({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 7);
    const cond = pick(seed + 3, CONDS);
    const temp = 12 + Math.floor(r() * 23);
    const start = Math.abs(seed) % DAYS.length;
    const days = Array.from({ length: 5 }, (_, i): WeatherDayRow => {
        const hi = temp - 2 + Math.floor(r() * 8);
        return {
            key: String(i),
            label: DAYS[(start + i) % DAYS.length],
            icon: i === 0 ? cond.name : CONDS[Math.floor(r() * CONDS.length)].name,
            lo: hi - 4 - Math.floor(r() * 6),
            hi
        };
    });

    return (
        <WeatherCard
            label={cond.label}
            icon={cond.name}
            temp={temp}
            place={pick(seed, CITIES)}
            days={days}
            air={airCategory(1 + Math.floor(r() * 5))}
        />
    );
}

/** Short weekday for a YYYY-MM-DD date, without timezone surprises. */
function weekday(date: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(
        new Date(`${date}T12:00:00`)
    );
}

/** The weather now and for the next five days, of a city or the device location. */
export function LiveWeather({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    return (
        <LiveWeatherFrame label={label} lowConfidence={lowConfidence} city={args.city}>
            {(data) => <LiveWeatherCard data={data} />}
        </LiveWeatherFrame>
    );
}

/**
 * The card of a loaded place. The air quality comes from the place's own
 * coordinates, so it is always the weather's place; until it is there, or
 * when it is not, the indicator stays away and the weather does not wait.
 */
function LiveWeatherCard({ data }: { data: WeatherSnapshot }): JSX.Element {
    const { latitude, longitude } = data.place;
    const air = useAirQuality({ latitude, longitude }).data;
    const info = weatherInfo(data.code);
    return (
        <WeatherCard
            label={info.label}
            icon={info.icon}
            temp={data.temperatureC}
            place={data.place.name}
            days={data.daily.map((day) => ({
                key: day.date,
                label: weekday(day.date),
                icon: weatherInfo(day.code).icon,
                lo: day.minC,
                hi: day.maxC
            }))}
            air={air?.status === 'ok' ? airCategory(air.data.aqi) : null}
        />
    );
}

export const weatherTile: TileDefinition = {
    id: 'weather',
    title: 'Weather',
    Component: Weather,
    Live: LiveWeather,
    providers: WEATHER_PROVIDERS,
    liveKey: ({ city }) => `weather:${city ?? ''}`,
    route: {
        description:
            'Current weather, temperature and the five-day forecast or rain outlook for a city.',
        keywords: [
            'weather',
            'temperature',
            'rain',
            'sunny',
            'hot',
            'cold',
            'windy',
            'forecast',
            'outlook',
            'weekend',
            'umbrella'
        ],
        examples: ['weather in Rome', '5 day forecast for Berlin', 'is it raining in Seattle'],
        pattern:
            /\b(?:weather|temperature|raining|rainy|sunny|snowing|humid|wind|windy|hot|cold|warm|forecast|outlook|umbrella|weekend|next week)\b/,
        weight: 3,
        args: ({ city }) => ({ city })
    }
};

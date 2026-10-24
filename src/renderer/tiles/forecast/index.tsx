import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveWeatherFrame } from '../../shell/kit/weather-frame';
import { ConditionIcon } from '../../shell/kit/icons';
import type { CondName } from '../../shell/kit/icons';
import { HUES, pick, rng } from '../../shell/kit/seed';
import { weatherInfo, weatherTone } from '../../shell/kit/weather';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CONDS: readonly CondName[] = ['sun', 'cloud', 'rain', 'snow', 'storm'];

interface MockDay {
    label: string;
    cond: CondName;
    hi: number;
    lo: number;
    precip: number;
    tone: string;
    iconTone: string;
}

function DayCell({ day }: { day: MockDay }): JSX.Element {
    return (
        <div className="flex flex-col items-center justify-between gap-1">
            <span
                className={`text-[9px] font-medium tracking-[0.1em] uppercase @min-[300px]:text-[10px] ${day.tone}`}
            >
                {day.label}
            </span>
            <ConditionIcon
                name={day.cond}
                className={`h-5 w-5 @min-[300px]:h-7 @min-[300px]:w-7 ${day.iconTone}`}
            />
            <div className="text-center">
                <div className="font-mono text-[11px] text-white/85 @min-[300px]:text-xs">
                    {day.hi}°
                </div>
                <div className="font-mono text-[9px] text-white/40">{day.lo}°</div>
                <div className="hidden font-mono text-[9px] text-white/30 @min-[300px]:block">
                    {day.precip}%
                </div>
            </div>
        </div>
    );
}

/** Five seeded days. The precipitation row and larger type appear on landscape tiles. */
export function Forecast({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 11);
    const hue = pick(seed, HUES);
    const start = Math.abs(seed) % DAYS.length;

    const days = Array.from({ length: 5 }, (_, i): MockDay => {
        const hi = 8 + Math.floor(r() * 16);
        return {
            label: DAYS[(start + i) % DAYS.length],
            cond: CONDS[Math.floor(r() * CONDS.length)],
            hi,
            lo: hi - 4 - Math.floor(r() * 6),
            precip: Math.floor(r() * 85),
            tone: i === 0 ? hue.text : 'text-white/50',
            iconTone: i === 0 ? hue.text : 'text-white/60'
        };
    });

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="5-Day" tag="THIS WEEK" />

            <div className="grid min-h-0 flex-1 grid-cols-5 gap-1.5 py-2">
                {days.map((day, i) => (
                    <DayCell key={`${day.label}-${i}`} day={day} />
                ))}
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">
                    HIGH {Math.max(...days.map((day) => day.hi))}°
                </span>
                <span className="text-[10px] text-white/40">
                    LOW {Math.min(...days.map((day) => day.lo))}°
                </span>
            </div>
        </div>
    );
}

/** Short weekday for a YYYY-MM-DD date, without timezone surprises. */
function weekday(date: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(
        new Date(`${date}T12:00:00`)
    );
}

function rainSummary(rainyDays: number): string {
    if (rainyDays === 0) {
        return 'No rain expected';
    }
    return `Rain likely on ${rainyDays} ${rainyDays === 1 ? 'day' : 'days'}`;
}

/** The next five days for a city, or for the device location. */
export function LiveForecast({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    return (
        <LiveWeatherFrame label={label} lowConfidence={lowConfidence} city={args.city}>
            {(data) => (
                <div className="flex h-full min-h-0 flex-col justify-between gap-2">
                    <div className="grid min-h-0 flex-1 grid-cols-5 gap-1">
                        {data.daily.map((day, index) => {
                            const info = weatherInfo(day.code);
                            const today = index === 0;
                            return (
                                <div
                                    key={day.date}
                                    className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 ${
                                        today
                                            ? 'border-white/20 bg-white/[0.07]'
                                            : 'border-white/10 bg-white/[0.025]'
                                    }`}
                                >
                                    <span className="text-[8px] font-medium tracking-[0.1em] text-white/45 uppercase">
                                        {today ? 'Today' : weekday(day.date)}
                                    </span>
                                    <ConditionIcon
                                        name={info.icon}
                                        className={`my-1 h-4 w-4 ${weatherTone(info.icon)}`}
                                    />
                                    <span className="font-mono text-[10px] leading-none text-white/80">
                                        {Math.round(day.maxC)}°
                                        <span className="ml-0.5 text-white/30">
                                            {Math.round(day.minC)}°
                                        </span>
                                    </span>
                                    <span className="mt-1 text-[8px] text-white/30">
                                        {day.precipitationProbability}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="truncate text-[9px] tracking-[0.12em] text-white/35 uppercase">
                        {rainSummary(
                            data.daily.filter((day) => day.precipitationProbability >= 45).length
                        )}
                    </div>
                </div>
            )}
        </LiveWeatherFrame>
    );
}

export const forecastTile: TileDefinition = {
    id: 'forecast',
    title: '5-Day Forecast',
    Component: Forecast,
    Live: LiveForecast,
    liveKey: ({ city }) => `forecast:${city ?? ''}`,
    route: {
        description: 'Multi-day weather forecast, rain outlook or weekend prediction for a city.',
        keywords: ['forecast', 'outlook', 'weekend', 'next week', 'umbrella'],
        examples: ['5 day forecast for Berlin', 'will it rain this weekend in Lisbon'],
        pattern: /\b(?:forecast|outlook|umbrella|weekend|next week)\b/,
        weight: 3,
        args: ({ city }) => ({ city })
    }
};

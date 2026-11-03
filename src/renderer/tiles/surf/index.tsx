import type { JSX } from 'react';
import { STORMGLASS } from '../../../shared/providers';
import type { SurfForecast, SurfHour, SurfRating, SurfWindow } from '../../../shared/surf';
import { bestWindow, rateSurf, waveRangeM } from '../../../shared/surf';
import type { GeoPlace } from '../../../shared/weather';
import { WIDGET_BODY } from '../../shell/kit/chrome';
import { useSurf, useSurfSpot, useTemperatureUnit } from '../../shell/kit/hooks';
import { LiveFrame, NeedsSetting, ProviderData } from '../../shell/kit/live';
import { pick, rng } from '../../shell/kit/seed';
import type { TemperatureUnit } from '../../shell/kit/weather';
import { lengthInUnit, lengthUnit, speedInUnit, speedUnit } from '../../shell/kit/weather';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const SPOTS = ['Ericeira', 'Hossegor', 'Nazaré', 'Mundaka', 'Sylt', 'Peniche'];
const NONE = '–';
/** The bars cover the surfing day at the spot: 6 AM to 6 PM, one bar per hour. */
const DAY_START = 6;
const DAY_HOURS = 12;
/** The best-surf window is the best four hours in a row. */
const WINDOW_HOURS = 4;

/** Badge, bar and dot colors per rating, as literal Tailwind classes. */
const RATING_STYLE: Record<SurfRating, { badge: string; bar: string; dot: string }> = {
    great: {
        badge: 'border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80]',
        bar: 'bg-[#4ade80]',
        dot: 'bg-[#4ade80]'
    },
    good: {
        badge: 'border-[#5eead4]/40 bg-[#5eead4]/10 text-[#5eead4]',
        bar: 'bg-[#5eead4]',
        dot: 'bg-[#5eead4]'
    },
    fair: {
        badge: 'border-[#fcd34d]/40 bg-[#fcd34d]/10 text-[#fcd34d]',
        bar: 'bg-[#fcd34d]',
        dot: 'bg-[#fcd34d]'
    },
    poor: {
        badge: 'border-destructive/40 bg-destructive/10 text-destructive',
        bar: 'bg-destructive',
        dot: 'bg-destructive'
    }
};

/** One bar of the day: the hour at the spot, the wave then, and its rating. */
interface DayHour {
    hour: number;
    waveHeightM: number | null;
    swellPeriodS: number | null;
    windKmh: number | null;
    rating: SurfRating;
}

interface SurfView {
    name: string;
    rating: SurfRating;
    /** The best-surf window as "2 PM – 6 PM", or `null` when no window is fair. */
    best: string | null;
    bars: DayHour[];
    window: SurfWindow | null;
    /** The wave range of the day, "3-5 ft", or a dash when every hour misses it. */
    range: string;
    period: string;
    wind: string;
    windDirection: number | null;
    tides: ReadonlyArray<{ type: 'high' | 'low'; time: string }>;
    footer?: string;
}

/** "2 PM" for an hour of the day. */
function hourLabel(hour: number): string {
    const h = hour % 24;
    return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The hour of the day at the spot for an ISO time. */
function hourInZone(iso: string, timeZone: string): number {
    return Number(
        new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
            Date.parse(iso)
        )
    );
}

/** HH:MM at the spot. */
function clockAt(iso: string, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).format(Date.parse(iso));
}

function hh(hours: number): string {
    return `${String(hours % 24).padStart(2, '0')}:00`;
}

/** The card both the resting and the live tile show: name, rating, day, footer. */
function buildView(
    name: string,
    current: Pick<SurfHour, 'waveHeightM' | 'swellPeriodS' | 'windKmh' | 'windDirection'>,
    day: DayHour[],
    unit: TemperatureUnit,
    tides: SurfView['tides'],
    footer?: string
): SurfView {
    const window = bestWindow(day, WINDOW_HOURS);
    const range = waveRangeM(day);
    return {
        name,
        rating: rateSurf(current),
        best: window
            ? `${hourLabel(day[window.start].hour)} – ${hourLabel(day[window.start].hour + (window.end - window.start))}`
            : null,
        bars: day,
        window,
        range: range
            ? `${lengthInUnit(range.min, unit)}-${lengthInUnit(range.max, unit)} ${lengthUnit(unit)}`
            : NONE,
        period: current.swellPeriodS === null ? NONE : `${Math.round(current.swellPeriodS)} s`,
        wind:
            current.windKmh === null
                ? NONE
                : `${speedInUnit(current.windKmh, unit)} ${speedUnit(unit)}`,
        windDirection: current.windDirection,
        tides,
        footer
    };
}

/** The arrow points to where the wind comes from, like a compass needle. */
function WindArrow({ degrees }: { degrees: number }): JSX.Element {
    return (
        <svg
            viewBox="0 0 16 16"
            className="size-2.5 text-white/60"
            style={{ transform: `rotate(${degrees}deg)` }}
        >
            <path
                d="M8 13V3M4.5 6.5 8 3l3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** The bars of the surfing day; the best window sits in a frame. */
function Bars({ view }: { view: SurfView }): JSX.Element {
    const max = Math.max(1, ...view.bars.map((bar) => bar.waveHeightM ?? 0));
    const bar = (day: DayHour, index: number): JSX.Element => (
        <div
            key={index}
            className={`min-w-0 flex-1 rounded-sm ${RATING_STYLE[day.rating].bar}`}
            style={{
                height: `${day.waveHeightM === null ? 6 : Math.max(12, (day.waveHeightM / max) * 100)}%`
            }}
        />
    );
    const { window } = view;
    return (
        <div className="flex h-14 items-end gap-[3px]">
            {window ? (
                <>
                    {view.bars.slice(0, window.start).map(bar)}
                    <div
                        className="flex min-w-0 items-end gap-[3px] rounded-md border border-white/15 bg-white/5 p-[3px]"
                        style={{ flexGrow: window.end - window.start }}
                    >
                        {view.bars.slice(window.start, window.end).map(bar)}
                    </div>
                    {view.bars.slice(window.end).map(bar)}
                </>
            ) : (
                view.bars.map(bar)
            )}
        </div>
    );
}

/** The surf card: name and rating on top, the best window, the day as bars. */
function SurfCard({ view }: { view: SurfView }): JSX.Element {
    const style = RATING_STYLE[view.rating];
    return (
        <div className={WIDGET_BODY}>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-white/90">{view.name}</span>
                <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-[0.14em] uppercase ${style.badge}`}
                >
                    {view.rating}
                </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-white/50">Best Surf</span>
                {view.best ? (
                    <span className="flex items-center gap-1.5 font-mono text-white/75">
                        <span className={`size-1.5 rounded-full ${style.dot}`} />
                        {view.best}
                    </span>
                ) : (
                    <span className="font-mono text-white/40">No surf today</span>
                )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-end gap-1">
                <Bars view={view} />
                <div className="flex justify-between font-mono text-[8px] text-white/35">
                    <span>6 AM</span>
                    <span>12 PM</span>
                    <span>6 PM</span>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-white/60">
                <span>
                    {view.range} · {view.period}
                </span>
                <span className="flex items-center gap-1">
                    {view.windDirection !== null ? (
                        <WindArrow degrees={view.windDirection} />
                    ) : null}
                    {view.wind}
                </span>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-white/40">
                <span>
                    {view.tides
                        .map((tide) => `${tide.type === 'high' ? 'High' : 'Low'} ${tide.time}`)
                        .join(' · ')}
                </span>
                {view.footer ? <span>{view.footer}</span> : null}
            </div>
        </div>
    );
}

export function Surf({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 53);
    const [unit] = useTemperatureUnit();
    const day: DayHour[] = Array.from({ length: DAY_HOURS }, (_, index) => {
        const part = {
            waveHeightM: 0.3 + r() * 2.4,
            swellPeriodS: 5 + r() * 11,
            windKmh: r() * 30
        };
        return { hour: DAY_START + index, ...part, rating: rateSurf(part) };
    });
    const current = { ...pick(seed + 7, day), windDirection: Math.round(r() * 360) };
    const start = DAY_START + 2 + Math.floor(r() * 4);
    const view = buildView(pick(seed, SPOTS), current, day, unit, [
        { type: 'high', time: hh(start + 2) },
        { type: 'low', time: hh(start + 8) }
    ]);
    return <SurfCard view={view} />;
}

/**
 * The live card as the tile shows it: the bars are 6 AM to 6 PM at the spot,
 * the rating and the footer are the current hour. `null` when the point is
 * not on the water.
 */
function liveView(
    data: SurfForecast,
    spot: GeoPlace,
    unit: TemperatureUnit,
    now: number
): SurfView | null {
    // The hours are in order: the current one is the last that has begun.
    const current = Math.max(
        0,
        data.hours.filter((hour) => Date.parse(hour.time) <= now).length - 1
    );
    const hour = data.hours[current];
    if (hour.waveHeightM === null) {
        return null;
    }
    const day: DayHour[] = data.hours
        .map((next) => ({ hour: hourInZone(next.time, spot.timezone), next }))
        .filter(({ hour }) => hour >= DAY_START && hour < DAY_START + DAY_HOURS)
        .map(({ hour, next }) => ({
            hour,
            waveHeightM: next.waveHeightM,
            swellPeriodS: next.swellPeriodS,
            windKmh: next.windKmh,
            rating: rateSurf(next)
        }));
    return buildView(
        spot.name,
        hour,
        day,
        unit,
        data.tides
            .filter((tide) => Date.parse(tide.time) > now)
            .slice(0, 2)
            .map((tide) => ({ type: tide.type, time: clockAt(tide.time, spot.timezone) })),
        `updated ${clockAt(data.fetchedAt, spot.timezone)}`
    );
}

function LiveSpot({
    label,
    lowConfidence,
    spot
}: {
    label: string;
    lowConfidence: boolean;
    spot: GeoPlace;
}): JSX.Element {
    const state = useSurf(spot);
    const [unit] = useTemperatureUnit();
    return (
        <ProviderData
            label={label}
            lowConfidence={lowConfidence}
            provider={STORMGLASS}
            state={state}
        >
            {(data) => {
                const view = liveView(data, spot, unit, Date.now());
                if (view === null) {
                    return (
                        <NeedsSetting message="No wave data at this spot. Move it onto the water in the settings." />
                    );
                }
                return <SurfCard view={view} />;
            }}
        </ProviderData>
    );
}

/** The forecast of the surf spot; a city in the utterance never replaces it. */
export function LiveSurf({ label, lowConfidence }: LiveTileProps): JSX.Element {
    const [spot] = useSurfSpot();
    if (!spot) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <NeedsSetting message="Set a surf spot first." />
            </LiveFrame>
        );
    }
    return <LiveSpot label={label} lowConfidence={lowConfidence} spot={spot} />;
}

export const surfTile: TileDefinition = {
    id: 'surf',
    title: 'Surf',
    Component: Surf,
    Live: LiveSurf,
    providers: [STORMGLASS],
    surfSpot: true,
    liveKey: () => 'surf',
    route: {
        description: 'Surf forecast at the saved surf spot: waves, swell, wind and tides.',
        keywords: ['surf', 'waves', 'swell', 'tide', 'surf forecast'],
        examples: ['surf forecast', 'how big are the waves'],
        pattern: /\b(?:surf(?:ing)?|waves?|swell|tides?)\b/,
        weight: 3.5
    }
};

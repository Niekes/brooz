import type { JSX } from 'react';
import { STORMGLASS } from '../../../shared/providers';
import type { SurfForecast } from '../../../shared/surf';
import type { GeoPlace } from '../../../shared/weather';
import { Eyebrow, WIDGET_BODY } from '../../shell/kit/chrome';
import { useSurf, useSurfSpot, useTemperatureUnit } from '../../shell/kit/hooks';
import { LiveFrame, NeedsSetting, ProviderData } from '../../shell/kit/live';
import { pick, rng } from '../../shell/kit/seed';
import { inUnit } from '../../shell/kit/weather';
import type { TemperatureUnit } from '../../shell/kit/weather';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const SPOTS = ['Ericeira', 'Hossegor', 'Nazaré', 'Mundaka', 'Sylt', 'Peniche'];
const POINTS = 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split(' ');
const NONE = '–';

/** Where a direction in degrees comes from, on the 16-point compass. */
function compass(degrees: number | null): string {
    return degrees === null ? NONE : POINTS[Math.round(degrees / 22.5) % 16];
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

function amount(value: number | null, unit: string, digits = 1): string {
    return value === null ? NONE : `${value.toFixed(digits)} ${unit}`;
}

interface SurfView {
    wave: string;
    swell: string;
    wind: string;
    water: string;
    /** The coming hours: a time and the wave height then. */
    next: ReadonlyArray<{ time: string; wave: string }>;
    tides: ReadonlyArray<{ type: 'high' | 'low'; time: string }>;
}

/** The surf as the resting and the live tile both show it. */
function SurfBody({ view, footer }: { view: SurfView; footer?: string }): JSX.Element {
    return (
        <div className="flex h-full min-h-0 flex-col justify-between gap-2">
            <div className="flex items-end justify-between gap-3">
                <div className="text-4xl leading-none font-light tracking-tight">{view.wave}</div>
                <div className="min-w-0 text-right text-[10px] text-white/60">
                    <div>Swell {view.swell}</div>
                    <div>Wind {view.wind}</div>
                    <div>Water {view.water}</div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-white/55">
                {view.next.map((hour) => (
                    <div key={hour.time} className="rounded-lg bg-white/5 px-2 py-1">
                        <div className="text-white/35">{hour.time}</div>
                        <div>{hour.wave}</div>
                    </div>
                ))}
            </div>
            <div className="flex items-end justify-between gap-2 font-mono text-[10px] text-white/45">
                {view.tides.map((tide) => (
                    <span key={`${tide.type}:${tide.time}`}>
                        {tide.type === 'high' ? 'High' : 'Low'} {tide.time}
                    </span>
                ))}
                {footer ? <span className="truncate">{footer}</span> : null}
            </div>
        </div>
    );
}

function hh(hours: number): string {
    return `${String(hours % 24).padStart(2, '0')}:00`;
}

export function Surf({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 53);
    const [unit] = useTemperatureUnit();
    const wave = 0.5 + r() * 2;
    const start = 6 + Math.floor(r() * 6);
    const view: SurfView = {
        wave: amount(wave, 'm'),
        swell: `${Math.round(8 + r() * 8)} s ${compass(r() * 360)}`,
        wind: `${Math.round(r() * 25)} km/h ${compass(r() * 360)}`,
        water: `${inUnit(12 + r() * 10, unit)}°`,
        next: [3, 6, 9].map((offset) => ({
            time: hh(start + offset),
            wave: amount(wave + (r() - 0.5) * 0.6, 'm')
        })),
        tides: [
            { type: 'high', time: hh(start + 2) },
            { type: 'low', time: hh(start + 8) }
        ]
    };
    return (
        <div className={WIDGET_BODY}>
            <div className="flex items-start justify-between gap-2">
                <Eyebrow>Surf</Eyebrow>
                <span className="truncate text-[10px] font-medium tracking-[0.16em] text-white/40 uppercase">
                    {pick(seed, SPOTS)}
                </span>
            </div>
            <SurfBody view={view} />
        </div>
    );
}

/** The live forecast as the tile shows it: from the current hour on, times at the spot. */
function liveView(
    data: SurfForecast,
    spot: GeoPlace,
    unit: TemperatureUnit,
    now: number
): SurfView {
    const time = (iso: string): string => clockAt(iso, spot.timezone);
    // The hours are in order: the current one is the last that has begun.
    const current = Math.max(
        0,
        data.hours.filter((hour) => Date.parse(hour.time) <= now).length - 1
    );
    const hour = data.hours[current];
    return {
        wave: amount(hour.waveHeightM, 'm'),
        swell: `${amount(hour.swellPeriodS, 's', 0)} ${compass(hour.swellDirection)}`,
        wind: `${amount(hour.windKmh, 'km/h', 0)} ${compass(hour.windDirection)}`,
        water: hour.waterTemperatureC === null ? NONE : `${inUnit(hour.waterTemperatureC, unit)}°`,
        next: [3, 6, 9]
            .map((offset) => data.hours[current + offset])
            .filter((next) => next !== undefined)
            .map((next) => ({ time: time(next.time), wave: amount(next.waveHeightM, 'm') })),
        tides: data.tides
            .filter((tide) => Date.parse(tide.time) > now)
            .slice(0, 2)
            .map((tide) => ({ type: tide.type, time: time(tide.time) }))
    };
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
            meta={() => spot.name}
        >
            {(data) => {
                const view = liveView(data, spot, unit, Date.now());
                if (view.wave === NONE) {
                    return (
                        <NeedsSetting message="No wave data at this spot. Move it onto the water in the settings." />
                    );
                }
                return (
                    <SurfBody
                        view={view}
                        footer={`updated ${clockAt(data.fetchedAt, spot.timezone)}`}
                    />
                );
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

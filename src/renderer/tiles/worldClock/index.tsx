import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveError, LiveFrame, LiveSkeleton } from '../../shell/kit/live';
import { useNow, usePlace } from '../../shell/kit/hooks';
import { HUES, clock, pick } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

/** Whole-hour offsets only, so every city shares the same minutes, like a real round UTC hour. */
const CITIES = [
    { name: 'Tokyo', off: 9 },
    { name: 'New York', off: -4 },
    { name: 'London', off: 1 },
    { name: 'Dubai', off: 4 },
    { name: 'Paris', off: 2 },
    { name: 'Sydney', off: 10 },
    { name: 'Los Angeles', off: -7 },
    { name: 'Singapore', off: 8 }
];

const BASE_UTC_HOUR = 10;
const BASE_UTC_MINUTE = 10;

/** Three seeded cities against one frozen UTC instant. */
export function WorldClock({ seed }: TileProps): JSX.Element {
    const first = Math.abs(seed) % CITIES.length;
    const rows = [0, 3, 5].map((step) => CITIES[(first + step) % CITIES.length]);
    const hue = pick(seed, HUES);

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="World Clock" tag="UTC" />

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
                {rows.map((city) => {
                    const hour = (((BASE_UTC_HOUR + city.off) % 24) + 24) % 24;
                    return (
                        <div key={city.name} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="truncate text-[11px] font-medium tracking-[0.12em] text-white/70 uppercase">
                                    {city.name}
                                </div>
                                <div className="font-mono text-[9px] text-white/30">
                                    UTC{city.off < 0 ? '−' : '+'}
                                    {String(Math.abs(city.off)).padStart(2, '0')}:00
                                </div>
                            </div>
                            <span className={`font-mono text-base ${hue.text}`}>
                                {clock(hour, BASE_UTC_MINUTE)}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-end justify-between">
                <span className="font-mono text-[10px] text-white/40">
                    {clock(BASE_UTC_HOUR, BASE_UTC_MINUTE)} UTC
                </span>
                <span className="text-[10px] text-white/30">3 ZONES</span>
            </div>
        </div>
    );
}

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    return parts.find((entry) => entry.type === type)!.value;
}

/** The time in a city, or the local time when the utterance named none. */
export function LiveWorldClock({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    const now = useNow();
    const { city } = args;
    const { data: place, error, reload } = usePlace(city);

    if (city && !place) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                {error ? <LiveError message={error} onRetry={reload} /> : <LiveSkeleton />}
            </LiveFrame>
        );
    }

    const zone: Intl.DateTimeFormatOptions = place ? { timeZone: place.timezone } : {};
    const time = new Intl.DateTimeFormat('en-GB', {
        ...zone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(now);
    const dateLabel = new Intl.DateTimeFormat('en-GB', {
        ...zone,
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    }).format(now);
    const offset = partOf(
        new Intl.DateTimeFormat('en-GB', { ...zone, timeZoneName: 'shortOffset' }).formatToParts(
            now
        ),
        'timeZoneName'
    );

    return (
        <LiveFrame label={label} meta={place?.name ?? 'Local'} lowConfidence={lowConfidence}>
            <div className="flex h-full min-h-0 flex-col justify-between gap-2">
                <div className="flex min-h-0 flex-1 items-center gap-2">
                    <span className="font-mono text-4xl leading-none font-light tracking-tight text-white">
                        {partOf(time, 'hour')}:{partOf(time, 'minute')}
                    </span>
                    <span className="font-mono text-lg leading-none text-white/30">
                        {partOf(time, 'second')}
                    </span>
                </div>

                <div className="flex items-end justify-between gap-2 text-[9px] text-white/40">
                    <span className="truncate">{dateLabel}</span>
                    <span className="shrink-0 font-mono text-white/30">
                        {offset} · {place?.timezone ?? 'local'}
                    </span>
                </div>
            </div>
        </LiveFrame>
    );
}

export const worldClockTile: TileDefinition = {
    id: 'world-clock',
    title: 'World Clock',
    Component: WorldClock,
    Live: LiveWorldClock,
    liveKey: ({ city }) => `world-clock:${city ?? ''}`,
    route: {
        description: 'Current local time in another city or time zone.',
        keywords: ['time', 'clock', 'timezone', 'time zone', "o'clock"],
        examples: ['what time is it in Tokyo', 'time in New York'],
        pattern: /\b(?:what time|time in|time zone|timezone|o'clock)\b/,
        weight: 3.5,
        args: ({ city }) => ({ city })
    }
};

import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { HUES, pick, rng } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TITLES = [
    'Design review',
    '1:1 with Sam',
    'Standup',
    'Ship v2.3',
    'Portfolio sync',
    'Lunch — Kaito',
    'Deep work block',
    'Retro',
    'Gym session',
    'Dentist'
];
const TIMES = ['09:00', '10:30', '11:15', '13:00', '15:30', '17:00'];

/** A seeded date and three events; the third one only fits on landscape tiles. */
export function Calendar({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const r = rng(seed + 19);
    const month = pick(seed, MONTHS);
    const day = ((seed * 7) % 28) + 1;
    const events = [0, 1, 2].map((i) => ({
        time: TIMES[(seed + i * 2) % TIMES.length],
        title: TITLES[(seed + i * 3) % TITLES.length],
        duration: `${15 + Math.floor(r() * 4) * 15}M`,
        visibility: i === 2 ? 'hidden @min-[300px]:flex' : 'flex'
    }));

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Calendar" tag={`${events.length} EVENTS`} />

            <div className="flex min-h-0 flex-1 flex-col gap-3 @min-[300px]:flex-row @min-[300px]:items-stretch @min-[300px]:gap-5">
                <div className="shrink-0 @min-[300px]:flex @min-[300px]:flex-col @min-[300px]:justify-center">
                    <div
                        className={`text-[10px] font-medium tracking-[0.2em] uppercase ${hue.text}`}
                    >
                        {month}
                    </div>
                    <div className="text-4xl leading-none font-light text-white">{day}</div>
                    <div className="text-[10px] tracking-[0.16em] text-white/45 uppercase">
                        {WEEKDAYS[(seed * 3 + day) % 7]}
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 @min-[300px]:justify-center">
                    {events.map((event, i) => (
                        <div
                            key={event.time + i}
                            className={`items-baseline gap-2.5 ${event.visibility}`}
                        >
                            <span className="w-9 shrink-0 font-mono text-[11px] text-white/45">
                                {event.time}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                                {event.title}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] text-white/30">
                                {event.duration}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">WEEK 42</span>
                <span className="font-mono text-[10px] text-white/30">
                    {month.toUpperCase()} 2026
                </span>
            </div>
        </div>
    );
}

export const calendarTile: TileDefinition = {
    id: 'calendar',
    title: 'Calendar',
    Component: Calendar,
    route: {
        description: 'Upcoming appointments, meetings and events on a date.',
        keywords: ['calendar', 'meeting', 'appointment', 'schedule', 'event'],
        examples: ["what's on my calendar tomorrow", 'show my meetings today'],
        pattern: /\b(?:calendars?|meetings?|appointments?|schedules?|events?)\b/,
        weight: 3,
        args: ({ when }) => ({ when })
    }
};

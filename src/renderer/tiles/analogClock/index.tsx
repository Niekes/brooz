import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveFrame } from '../../shell/kit/live';
import { useNow } from '../../shell/kit/hooks';
import { HUES, clock, pick } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

/** Frozen poses, classic watch-ad times, one per seed. */
const POSES: ReadonlyArray<[number, number]> = [
    [10, 10],
    [8, 20],
    [1, 50],
    [7, 35],
    [3, 45],
    [5, 25]
];

const R = 44;
const CENTER = 50;

function hand(angleDeg: number, length: number): { x: number; y: number } {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: CENTER + Math.cos(rad) * length, y: CENTER + Math.sin(rad) * length };
}

function Hand({
    from,
    to,
    stroke,
    width
}: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    stroke: string;
    width: number;
}): JSX.Element {
    return (
        <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
        />
    );
}

/** The mock dial: a faint disc and twelve ticks, longer at the quarters. */
function MockFace(): JSX.Element {
    return (
        <>
            <circle
                cx={CENTER}
                cy={CENTER}
                r={R}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
            />
            {Array.from({ length: 12 }, (_, i) => {
                const major = i % 3 === 0;
                const outer = hand(i * 30, R);
                const inner = hand(i * 30, R - (major ? 7 : 4));
                return (
                    <line
                        key={i}
                        x1={inner.x}
                        y1={inner.y}
                        x2={outer.x}
                        y2={outer.y}
                        stroke={major ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)'}
                        strokeWidth={major ? 1.6 : 1}
                    />
                );
            })}
        </>
    );
}

/** A static analog clock: hands frozen in a pleasant pose, the second hand in the tile's hue. */
export function AnalogClock({ seed }: TileProps): JSX.Element {
    const [hour, minute] = pick(seed, POSES);
    const hue = pick(seed, HUES).hex;
    const middle = { x: CENTER, y: CENTER };
    const secondAngle = 180;

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Clock" tag="MOCK" />

            <div className="flex min-h-0 flex-1 items-center justify-center py-2">
                <svg
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    className="h-auto w-full max-h-full max-w-full"
                >
                    <MockFace />
                    <Hand
                        from={middle}
                        to={hand((hour % 12) * 30 + minute * 0.5, R * 0.5)}
                        stroke="rgba(255,255,255,0.95)"
                        width={3.4}
                    />
                    <Hand
                        from={middle}
                        to={hand(minute * 6, R * 0.72)}
                        stroke="rgba(255,255,255,0.8)"
                        width={2}
                    />
                    <Hand
                        from={hand(secondAngle + 180, R * 0.14)}
                        to={hand(secondAngle, R * 0.82)}
                        stroke={hue}
                        width={1.2}
                    />
                    <circle cx={CENTER} cy={CENTER} r="2.6" fill={hue} />
                    <circle cx={CENTER} cy={CENTER} r="1" fill="rgba(10,10,10,0.9)" />
                </svg>
            </div>

            <div className="flex items-end justify-between">
                <span className="font-mono text-lg text-white/85">{clock(hour, minute)}</span>
                <span className="font-mono text-[10px] text-white/35">LOCAL</span>
            </div>
        </div>
    );
}

const C = 100;
const FACE = 92;

function LiveHand({
    angle,
    tail,
    length,
    stroke,
    width
}: {
    angle: number;
    tail: number;
    length: number;
    stroke: string;
    width: number;
}): JSX.Element {
    return (
        <line
            x1={C}
            y1={C + tail}
            x2={C}
            y2={C - length}
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
            transform={`rotate(${angle} ${C} ${C})`}
        />
    );
}

function Face(): JSX.Element {
    return (
        <>
            <circle
                cx={C}
                cy={C}
                r={FACE}
                fill="rgba(255,255,255,0.025)"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1"
            />
            <circle
                cx={C}
                cy={C}
                r={FACE - 7}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.8"
            />
            {Array.from({ length: 60 }, (_, index) => {
                const major = index % 5 === 0;
                const angle = (index * 6 * Math.PI) / 180;
                const outer = FACE - 5;
                const inner = outer - (major ? 9 : 4);
                return (
                    <line
                        key={index}
                        x1={C + Math.sin(angle) * inner}
                        y1={C - Math.cos(angle) * inner}
                        x2={C + Math.sin(angle) * outer}
                        y2={C - Math.cos(angle) * outer}
                        stroke={major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)'}
                        strokeWidth={major ? 1.6 : 0.8}
                        strokeLinecap="round"
                    />
                );
            })}
            {Array.from({ length: 12 }, (_, index) => {
                const label = index + 1;
                const angle = (label * 30 * Math.PI) / 180;
                return (
                    <text
                        key={label}
                        x={C + Math.sin(angle) * (FACE - 23)}
                        y={C - Math.cos(angle) * (FACE - 23)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(255,255,255,0.42)"
                        fontSize="8.5"
                        fontFamily="ui-monospace, monospace"
                    >
                        {label}
                    </text>
                );
            })}
        </>
    );
}

/** The digital time, the date and the time zone beside the dial. */
function Readout({ now }: { now: Date }): JSX.Element {
    const digital = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).format(now);
    const dateLabel = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    }).format(now);
    return (
        <div className="min-w-0 text-right">
            <div className="font-mono text-2xl leading-none font-light tracking-tight text-white">
                {digital}
            </div>
            <div className="mt-1 truncate text-[9px] text-white/40">{dateLabel}</div>
            <div className="mt-2 truncate font-mono text-[8px] tracking-[0.12em] text-white/25 uppercase">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </div>
        </div>
    );
}

/** The real clock: the device's local time, ticking every second. */
export function LiveAnalogClock({ label, lowConfidence }: LiveTileProps): JSX.Element {
    const now = useNow();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    return (
        <LiveFrame label={label} meta="Local" lowConfidence={lowConfidence}>
            <div className="flex h-full min-h-0 items-center justify-between gap-3">
                <svg
                    viewBox="0 0 200 200"
                    className="h-[7.5rem] w-[7.5rem] shrink-0 drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]"
                    aria-hidden="true"
                >
                    <Face />
                    <LiveHand
                        angle={hours * 30}
                        tail={12}
                        length={46}
                        stroke="rgba(255,255,255,0.9)"
                        width={5}
                    />
                    <LiveHand
                        angle={minutes * 6}
                        tail={14}
                        length={70}
                        stroke="rgba(255,255,255,0.72)"
                        width={3.2}
                    />
                    <LiveHand
                        angle={seconds * 6}
                        tail={16}
                        length={78}
                        stroke="#fda4af"
                        width={1.3}
                    />
                    <circle cx={C} cy={C} r="4" fill="#fda4af" />
                    <circle cx={C} cy={C} r="1.6" fill="rgba(0,0,0,0.6)" />
                </svg>

                <Readout now={now} />
            </div>
        </LiveFrame>
    );
}

export const analogClockTile: TileDefinition = {
    id: 'analog-clock',
    title: 'Analog Clock',
    Component: AnalogClock,
    Live: LiveAnalogClock,
    route: {
        description: 'A decorative analog clock face showing the local time.',
        keywords: ['analog clock', 'clock face', 'watch', 'local time'],
        examples: ['show me a clock', 'put a classic clock on screen'],
        pattern: /\b(?:analog clock|clock face|clocks?|watch)\b/,
        weight: 2.5
    }
};

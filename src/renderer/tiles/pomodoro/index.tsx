import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ProgressRing, TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveFrame } from '../../shell/kit/live';
import { HUES, clock, pick, rng } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const LABELS = ['Focus', 'Deep Work', 'Warm-up', 'Review'];
const CYCLE = 1500;
const DEFAULT_MINUTES = 25;

/** `MM:SS` from seconds. */
function countdown(seconds: number): string {
    return clock(Math.floor(seconds / 60), seconds % 60);
}

/** A frozen countdown ring; the "ends at" clock derives from the same seed. */
export function Pomodoro({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const elapsed = 0.25 + rng(seed + 23)() * 0.55;
    const remaining = Math.round(CYCLE * (1 - elapsed));
    const now = 9 * 60 + (Math.abs(seed) % 480);
    const end = (now + remaining) % 1440;

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Pomodoro" tag={`SESSION ${(Math.abs(seed) % 4) + 1}/4`} />

            <div className="relative min-h-0 flex-1">
                <svg
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full"
                >
                    <ProgressRing radius={40} width={7} progress={elapsed} stroke={hue.hex} />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center">
                        <div className="font-mono text-2xl text-white">{countdown(remaining)}</div>
                        <div className={`text-[9px] tracking-[0.2em] uppercase ${hue.text}`}>
                            {pick(seed + 1, LABELS)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">25 MIN CYCLE</span>
                <span className="font-mono text-[10px] text-white/30">
                    ENDS {clock(Math.floor(end / 60), end % 60)}
                </span>
            </div>
        </div>
    );
}

function statusOf(done: boolean, running: boolean, fresh: boolean): string {
    if (done) {
        return 'Complete';
    }
    if (running) {
        return 'In focus';
    }
    return fresh ? 'Ready' : 'Paused';
}

const BUTTON =
    'rounded-full border px-2.5 py-1 text-[8px] font-medium tracking-[0.14em] uppercase transition-colors';

interface Countdown {
    remaining: number;
    done: boolean;
    ticking: boolean;
    toggle: () => void;
    reset: () => void;
}

/** A countdown from `total` seconds that ticks while it runs. */
function useCountdown(total: number, autoStart: boolean): Countdown {
    const [remaining, setRemaining] = useState(total);
    const [running, setRunning] = useState(autoStart);
    const done = remaining === 0;
    const ticking = running && !done;

    useEffect(() => {
        if (!ticking) {
            return;
        }
        const id = setTimeout(() => setRemaining((value) => value - 1), 1000);
        return () => clearTimeout(id);
    }, [ticking, remaining]);

    const toggle = (): void => {
        if (done) {
            setRemaining(total);
            setRunning(true);
        } else {
            setRunning((value) => !value);
        }
    };
    const reset = (): void => {
        setRemaining(total);
        setRunning(false);
    };
    return { remaining, done, ticking, toggle, reset };
}

function Dial({ timer, total }: { timer: Countdown; total: number }): JSX.Element {
    const { remaining, done, ticking } = timer;
    return (
        <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
                <ProgressRing
                    radius={42}
                    width={6}
                    progress={1 - remaining / total}
                    stroke={done ? '#4ade80' : '#fcd34d'}
                />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                    <div className="font-mono text-xl leading-none font-light tracking-tight text-white">
                        {countdown(remaining)}
                    </div>
                    <div className="mt-1 text-[7px] font-medium tracking-[0.16em] text-white/40 uppercase">
                        {statusOf(done, ticking, remaining === total)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Controls({ timer }: { timer: Countdown }): JSX.Element {
    let primary = 'Start';
    if (timer.done) {
        primary = 'Again';
    } else if (timer.ticking) {
        primary = 'Pause';
    }
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[9px] leading-snug text-white/40">
                One task, one timer. The countdown runs in this window.
            </p>
            <div className="flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={timer.toggle}
                    className={`${BUTTON} border-white/15 bg-white/10 text-white hover:bg-white/15`}
                >
                    {primary}
                </button>
                <button
                    type="button"
                    onClick={timer.reset}
                    className={`${BUTTON} border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/10 hover:text-white`}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

/** A real focus timer. It starts on its own when the utterance said so. */
export function LivePomodoro({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    const minutes = args.durationMinutes ?? DEFAULT_MINUTES;
    const total = Math.max(1, Math.min(180, minutes)) * 60;
    const timer = useCountdown(total, args.action === 'start');

    return (
        <LiveFrame label={label} meta={`${minutes} min`} lowConfidence={lowConfidence}>
            <div className="flex h-full min-h-0 items-center gap-3">
                <Dial timer={timer} total={total} />
                <Controls timer={timer} />
            </div>
        </LiveFrame>
    );
}

export const pomodoroTile: TileDefinition = {
    id: 'pomodoro',
    title: 'Pomodoro',
    Component: Pomodoro,
    Live: LivePomodoro,
    liveKey: ({ durationMinutes, action }) =>
        `pomodoro:${durationMinutes ?? DEFAULT_MINUTES}:${action ?? ''}`,
    route: {
        description: 'Start, pause or reset a focus timer or pomodoro session.',
        keywords: ['timer', 'pomodoro', 'focus', 'countdown', 'minutes'],
        examples: ['start a 25 minute timer', 'begin a focus session'],
        pattern: /\b(?:timers?|pomodoro|focus session|countdown|minutes?)\b/,
        weight: 3,
        args: ({ durationMinutes, action }) => ({ durationMinutes, action: action ?? 'start' })
    }
};

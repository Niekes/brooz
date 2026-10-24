import type { JSX, ReactNode } from 'react';

/** Standard tile body: fills the tile's content box with three vertical bands. */
export const WIDGET_BODY = 'flex h-full w-full min-h-0 flex-col justify-between';

/** The shared eyebrow label, so every resting tile's header looks related. */
export function Eyebrow({ children }: { children: ReactNode }): JSX.Element {
    return (
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
            {children}
        </span>
    );
}

/** A resting tile's header: the eyebrow left, a small mono tag right. */
export function TileHeader({ title, tag }: { title: string; tag: ReactNode }): JSX.Element {
    return (
        <div className="flex items-start justify-between">
            <Eyebrow>{title}</Eyebrow>
            <span className="font-mono text-[10px] text-white/30">{tag}</span>
        </div>
    );
}

/**
 * A progress ring in a 100x100 viewBox: a faint track and an arc that
 * starts at twelve o'clock.
 */
export function ProgressRing({
    radius,
    width,
    progress,
    stroke,
    opacity = 1
}: {
    radius: number;
    width: number;
    progress: number;
    stroke: string;
    opacity?: number;
}): JSX.Element {
    const circumference = 2 * Math.PI * radius;
    return (
        <g transform="rotate(-90 50 50)">
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={width}
            />
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - Math.min(1, progress))}
            />
        </g>
    );
}

import { useState } from 'react';
import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveFrame } from '../../shell/kit/live';
import { HUES, pick, rng } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';
import { getMoonPhase, litPath } from './moon';

const PHASES = [
    { name: 'New Moon', illum: 0 },
    { name: 'Waxing Crescent', illum: 0.25 },
    { name: 'First Quarter', illum: 0.5 },
    { name: 'Waxing Gibbous', illum: 0.75 },
    { name: 'Full Moon', illum: 1 },
    { name: 'Waning Gibbous', illum: 0.75 },
    { name: 'Last Quarter', illum: 0.5 },
    { name: 'Waning Crescent', illum: 0.25 }
];

const R = 26;
const C = 32;
const MIRROR = (size: number): string => `translate(${size},0) scale(-1,1)`;

function MockDisc({
    stars,
    hue,
    illum,
    waxing
}: {
    stars: Array<{ x: number; y: number; o: number }>;
    hue: string;
    illum: number;
    waxing: boolean;
}): JSX.Element {
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="h-auto w-24 shrink-0">
            {stars.map((star, k) => (
                <circle key={k} cx={star.x} cy={star.y} r="0.9" fill="#fff" opacity={star.o} />
            ))}
            <circle cx={C} cy={C} r={R + 7} fill={hue} opacity="0.12" />
            <circle
                cx={C}
                cy={C}
                r={R}
                fill="rgba(255,255,255,0.07)"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="0.8"
            />
            <g transform={waxing ? undefined : MIRROR(64)}>
                <path d={litPath(illum, C, R)} fill={hue} opacity="0.92" />
            </g>
        </svg>
    );
}

/** A seeded phase with a little jitter, a few stars kept clear of the disc. */
export function MoonPhase({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const r = rng(seed + 31);
    const index = Math.abs(seed) % PHASES.length;
    const phase = PHASES[index];
    const jitter = (r() - 0.5) * 0.06;
    const illum =
        phase.illum === 0 || phase.illum === 1
            ? phase.illum
            : Math.min(1, Math.max(0, phase.illum + jitter));

    const stars = Array.from({ length: 6 }, () => {
        const x = 4 + r() * 56;
        const y = 4 + r() * 56;
        return { x, y, o: 0.15 + r() * 0.35 };
    }).filter((star) => Math.hypot(star.x - C, star.y - C) >= R + 6);

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Moon" tag={`AGE ${Math.round((index / PHASES.length) * 29.53)}D`} />

            <div className="flex min-h-0 flex-1 items-center gap-4">
                <MockDisc stars={stars} hue={hue.hex} illum={illum} waxing={index <= 4} />

                <div className="min-w-0">
                    <div className="text-[11px] font-medium tracking-[0.16em] text-white/75 uppercase">
                        {phase.name}
                    </div>
                    <div className="mt-0.5 text-2xl leading-none font-light text-white">
                        {Math.round(illum * 100)}%
                    </div>
                    <div className="text-[9px] tracking-[0.14em] text-white/35 uppercase">
                        Illuminated
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">SYNODIC 29.5D</span>
                <span className="font-mono text-[10px] text-white/30">PHASE {index + 1}/8</span>
            </div>
        </div>
    );
}

const LIVE_C = 100;
const LIVE_R = 76;

const STARS = [
    { x: 18, y: 26, o: 0.5 },
    { x: 174, y: 34, o: 0.35 },
    { x: 34, y: 166, o: 0.28 },
    { x: 164, y: 158, o: 0.45 },
    { x: 192, y: 102, o: 0.22 },
    { x: 8, y: 112, o: 0.3 },
    { x: 118, y: 12, o: 0.4 }
];

function LiveDisc({
    illumination,
    waxing
}: {
    illumination: number;
    waxing: boolean;
}): JSX.Element {
    return (
        <svg viewBox="0 0 200 200" className="h-24 w-24 shrink-0" aria-hidden="true">
            {STARS.map((star) => (
                <circle
                    key={`${star.x}-${star.y}`}
                    cx={star.x}
                    cy={star.y}
                    r="0.9"
                    fill="#fff"
                    opacity={star.o}
                />
            ))}
            <circle cx={LIVE_C} cy={LIVE_C} r={LIVE_R + 12} fill="#a78bfa" opacity="0.08" />
            <circle
                cx={LIVE_C}
                cy={LIVE_C}
                r={LIVE_R}
                fill="rgba(255,255,255,0.045)"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="0.9"
            />
            <g transform={waxing ? undefined : MIRROR(200)}>
                <path d={litPath(illumination, LIVE_C, LIVE_R)} fill="#e9d5ff" opacity="0.92" />
            </g>
            <circle
                cx={LIVE_C}
                cy={LIVE_C}
                r={LIVE_R}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="0.9"
            />
        </svg>
    );
}

/** Tonight's moon, computed locally. */
export function LiveMoon({ label, lowConfidence }: LiveTileProps): JSX.Element {
    const [moon] = useState(() => getMoonPhase(new Date()));
    const nextFull = moon.nextFullMoon.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
    });

    return (
        <LiveFrame
            label={label}
            meta={moon.waxing ? 'Waxing' : 'Waning'}
            lowConfidence={lowConfidence}
        >
            <div className="flex h-full min-h-0 items-center gap-3">
                <LiveDisc illumination={moon.illumination} waxing={moon.waxing} />

                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-base" aria-hidden="true">
                            {moon.emoji}
                        </span>
                        <h3 className="truncate text-sm font-light text-white">{moon.name}</h3>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl leading-none font-light text-white/90">
                            {Math.round(moon.illumination * 100)}%
                        </span>
                        <span className="text-[8px] font-medium tracking-[0.14em] text-white/35 uppercase">
                            lit
                        </span>
                    </div>

                    <div className="mt-2 text-[9px] leading-snug text-white/35">
                        Next full moon <span className="text-white/60">{nextFull}</span>
                        {moon.daysUntilFull === 0 ? ' · today' : ` · in ${moon.daysUntilFull} days`}
                    </div>
                </div>
            </div>
        </LiveFrame>
    );
}

export const moonPhaseTile: TileDefinition = {
    id: 'moon-phase',
    title: 'Moon Phase',
    Component: MoonPhase,
    Live: LiveMoon,
    route: {
        description: 'Current moon phase and lunar calendar.',
        keywords: ['moon', 'lunar', 'full moon', 'new moon', 'phase'],
        examples: ["what's the moon phase tonight", 'is it a full moon today'],
        pattern: /\b(?:moon|lunar)\b/,
        weight: 3.5
    }
};

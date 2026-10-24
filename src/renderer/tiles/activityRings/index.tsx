import type { JSX } from 'react';
import { ProgressRing, TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { HUES, pick, rng } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

const STROKE_W = 9;
const RADII = [44, 31, 18];
/** One hue, three opacity steps: the rings still read as separate layers. */
const OPACITY = [1, 0.7, 0.45];

interface Stat {
    label: string;
    value: string;
    progress: number;
}

function StatRow({
    stat,
    hue,
    opacity
}: {
    stat: Stat;
    hue: string;
    opacity: number;
}): JSX.Element {
    return (
        <div className="flex w-full items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue, opacity }} />
                <span className="text-[9px] tracking-[0.14em] text-white/45 uppercase">
                    {stat.label}
                </span>
            </span>
            <span className="font-mono text-[11px] text-white/80">{stat.value}</span>
        </div>
    );
}

/** Seeded move, exercise and stand rings; stats beside them on landscape tiles. */
export function ActivityRings({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES).hex;
    const r = rng(seed + 13);
    const move = Math.round(260 + r() * 340);
    const exercise = Math.round(8 + r() * 26);
    const stand = Math.round(5 + r() * 6);

    const stats: Stat[] = [
        { label: 'Move', value: `${move}/600 KCAL`, progress: move / 600 },
        { label: 'Exercise', value: `${exercise}/30 MIN`, progress: exercise / 30 },
        { label: 'Stand', value: `${stand}/10 HRS`, progress: stand / 10 }
    ];

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Activity" tag="TODAY" />

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 @min-[300px]:flex-row @min-[300px]:gap-4">
                <svg
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    className="mx-auto h-auto w-full max-h-full max-w-full @min-[300px]:mx-0 @min-[300px]:h-full @min-[300px]:w-auto"
                >
                    {stats.map((stat, i) => (
                        <ProgressRing
                            key={stat.label}
                            radius={RADII[i]}
                            width={STROKE_W}
                            progress={stat.progress}
                            stroke={hue}
                            opacity={OPACITY[i]}
                        />
                    ))}
                </svg>

                <div className="flex shrink-0 flex-col gap-1.5 @min-[300px]:justify-center @min-[300px]:flex-1">
                    {stats.map((stat, i) => (
                        <StatRow key={stat.label} stat={stat} hue={hue} opacity={OPACITY[i]} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export const activityRingsTile: TileDefinition = {
    id: 'activity-rings',
    title: 'Activity Rings',
    Component: ActivityRings,
    route: {
        description:
            'Daily activity and fitness rings: move goal, calories burned, exercise and standing.',
        keywords: ['activity', 'rings', 'calories', 'fitness', 'move goal', 'steps'],
        examples: ['show my activity rings', 'how many calories did I burn today'],
        pattern: /\b(?:activity|rings|calories|fitness|move goal|steps)\b/,
        weight: 3.5
    }
};

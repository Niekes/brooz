import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { HUES, pick, rng } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

const NODES = ['NODE-07', 'HOMELAB', 'MAC-STUDIO', 'PI-CLUSTER'];

/**
 * Seeded CPU, MEM and NET bars. The percentage carries `order-last` on
 * portrait tiles, so a row reads label | bar | value, and the order resets
 * on landscape tiles, where a column reads label, value, bar.
 */
export function SystemStats({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const r = rng(seed + 17);
    const stats = [
        { label: 'CPU', pct: 8 + Math.floor(r() * 84) },
        { label: 'MEM', pct: 25 + Math.floor(r() * 63) },
        { label: 'NET', pct: 12 + Math.floor(r() * 83) }
    ];

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="System" tag={pick(seed, NODES)} />

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 @min-[300px]:flex-row @min-[300px]:items-stretch @min-[300px]:gap-5">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="flex min-w-0 flex-1 items-center gap-2.5 @min-[300px]:flex-col @min-[300px]:items-stretch @min-[300px]:gap-2"
                    >
                        <span className="shrink-0 text-[10px] tracking-[0.16em] text-white/45 uppercase">
                            {stat.label}
                        </span>
                        <span className="order-last shrink-0 font-mono text-[11px] text-white/80 @min-[300px]:order-none @min-[300px]:text-xl">
                            {stat.pct}%
                        </span>
                        <span className="h-1.5 min-w-0 flex-1 rounded-full bg-white/10 @min-[300px]:mt-auto @min-[300px]:flex-none">
                            <span
                                className="block h-full rounded-full"
                                style={{ width: `${stat.pct}%`, background: hue.hex }}
                            />
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">UPTIME 14D 06H</span>
                <span className="font-mono text-[10px] text-white/30">MOCK</span>
            </div>
        </div>
    );
}

export const systemStatsTile: TileDefinition = {
    id: 'system-stats',
    title: 'System Stats',
    Component: SystemStats,
    route: {
        description: 'CPU, memory, RAM and hardware load of this computer.',
        keywords: ['cpu', 'memory', 'ram', 'system', 'load', 'usage'],
        examples: ['how is my cpu doing', 'show memory usage'],
        pattern: /\b(?:cpu|memory|ram|usage|system|machine|under load|resource usage)\b/,
        weight: 3
    }
};

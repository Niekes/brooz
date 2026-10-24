import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { HUES, pick, rng } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

const SONGS = [
    { title: 'Neon Tide', artist: 'Glass Harbour' },
    { title: 'Soft Static', artist: 'Vera Lux' },
    { title: 'Slow Orbit', artist: 'Field Notes' },
    { title: 'Paper Moon', artist: 'Iris Kane' },
    { title: 'Deep Current', artist: 'Atoll' },
    { title: 'Winter Code', artist: 'Mono Lake' },
    { title: 'Amber Room', artist: 'Sun Cutter' },
    { title: 'After Glow', artist: 'Nocturne 9' }
];

const BARS = 30;

function duration(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Album art and a frozen waveform snapshot, seeded bar heights. */
export function NowPlaying({ seed }: TileProps): JSX.Element {
    const song = pick(seed, SONGS);
    const hue = pick(seed, HUES);
    const r = rng(seed + 29);
    const total = 160 + ((seed * 13) % 140);
    const played = 9 + (Math.abs(seed) % 12);
    const bars = Array.from({ length: BARS }, () => 4 + Math.floor(r() * 18));

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Now Playing" tag="LOSSLESS" />

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
                <div className="flex items-center gap-3.5">
                    <div
                        aria-hidden="true"
                        className="h-14 w-14 shrink-0 rounded-xl border border-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                        style={{ background: `linear-gradient(135deg, ${hue.hex}, ${hue.hex}55)` }}
                    />
                    <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-white">
                            {song.title}
                        </div>
                        <div className="truncate text-[11px] text-white/50">{song.artist}</div>
                    </div>
                </div>

                <div className="flex h-6 items-end gap-[2px]" aria-hidden="true">
                    {bars.map((height, i) => (
                        <span
                            key={i}
                            className="w-full rounded-full"
                            style={{
                                height: `${height}px`,
                                background: i < played ? hue.hex : 'rgba(255,255,255,0.22)'
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-end justify-between font-mono text-[10px] text-white/40">
                <span>{duration(Math.round((total * played) / BARS))}</span>
                <span>{duration(total)}</span>
            </div>
        </div>
    );
}

export const nowPlayingTile: TileDefinition = {
    id: 'now-playing',
    title: 'Now Playing',
    Component: NowPlaying,
    route: {
        description: 'Music playback: play, pause, skip or search for music.',
        keywords: ['music', 'play', 'playing', 'pause', 'song', 'track', 'spotify'],
        examples: ['play some jazz', 'pause the music'],
        pattern: /\b(?:play|playing|pause|songs?|tracks?|music|spotify|skip)\b/,
        weight: 2.5,
        args: ({ query, action }) => ({ query, action })
    }
};

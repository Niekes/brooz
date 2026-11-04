import type { JSX } from 'react';

/**
 * The default tile: the placeholder that fills every pool slot without a
 * registered tile, so the grid is never empty. It is not in the registry
 * and cannot be summoned; a click opens the settings, the surface that
 * manages providers and keys (docs/adr/0009).
 */
export function DefaultTile({ onOpenSettings }: { onOpenSettings: () => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={onOpenSettings}
            className="flex size-full flex-col items-center justify-center gap-2"
            aria-label="Default tile, open the settings"
        >
            <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-xl font-light text-white/50">
                +
            </span>
            <span className="text-[10px] font-medium tracking-[0.18em] text-white/35 uppercase">
                Default tile
            </span>
        </button>
    );
}

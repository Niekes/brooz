import { memo } from 'react';
import type { JSX, ReactNode, Ref } from 'react';

/**
 * Every tile shares this class string, so it is assembled once:
 *
 * - Geometry: absolutely positioned at the stage origin and sized from the
 *   stage's custom properties. Centering lives in layout (negative margins),
 *   so the animation loop only writes placement and rotation, and rotations
 *   apply about the card center. Offscreen until the first frame places it.
 * - `contain: strict` keeps a bounded paint, layout and style scope for the
 *   35-128 promoted card layers.
 * - The glass surface and a diagonal sheen standing in for a rim light.
 * - `@container` exposes the tile width to its content, so landscape
 *   variants switch on container size without JS.
 *
 * The engine writes transform and opacity straight onto the element; React
 * never touches them because the style prop stays empty.
 */
const TILE_CLASSES = [
    'absolute top-0 left-0',
    'p-[22px]',
    '[backface-visibility:hidden]',
    '[contain:strict]',
    'w-(--card-w) h-(--card-h)',
    'ml-[calc(var(--card-w)*-0.5)] mt-[calc(var(--card-h)*-0.5)]',
    '[transform:translate3d(-10000px,-10000px,0)]',
    'rounded-[22px] overflow-hidden',
    '[background:linear-gradient(160deg,rgba(0,0,0,0.35),rgba(0,0,0,0.95)_45%,rgba(0,0,0,0.8))]',
    'border border-white/[0.18]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_1px_rgba(255,255,255,0.12),inset_1px_0_0_rgba(255,255,255,0.1),inset_-1px_0_0_rgba(255,255,255,0.1),0_24px_50px_rgba(0,0,0,0.35)]',
    "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
    'before:[background:linear-gradient(125deg,rgba(255,255,255,0.22),rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,rgba(255,255,255,0.08))]',
    '@container',
    'flex flex-col justify-between'
].join(' ');

interface AppTileProps {
    /** The pool slot, stamped as data-index so the ref callback can map the node back. */
    index: number;
    /** The slot's content, memoized per slot by the grid. */
    children: ReactNode;
    /** The grid's stable ref callback. */
    ref: Ref<HTMLDivElement>;
}

function AppTileShell({ index, children, ref }: AppTileProps): JSX.Element {
    return (
        <div ref={ref} data-index={index} className={TILE_CLASSES}>
            {children}
        </div>
    );
}

/** One cell of the grid: the glass shell every tile renders inside. */
export const AppTile = memo(AppTileShell);

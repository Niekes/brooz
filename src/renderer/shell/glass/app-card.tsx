import type { CSSProperties, JSX, ReactNode } from 'react';

export interface AppCardProps {
    /** Arbitrary content. The card only supplies the glass surface. */
    children: ReactNode;
    /** Extra classes merged onto the card surface (position, width, layout). */
    className?: string;
    /** Inline style for the card surface, e.g. the custom properties below. */
    style?: CSSProperties;
}

/**
 * A reusable glass surface: translucent fill, backdrop blur, rim border,
 * drop and inset shadow, an angled edge highlight and a top-to-bottom sheen.
 *
 * Geometry that callers retune rides on custom properties with fallbacks:
 *
 *   --app-card-radius  corner radius      (default 8px)
 *   --app-card-bg      surface fill       (default rgba(23,23,23,0.05))
 *   --app-card-pad     inner padding      (default 24px)
 *
 * Setting the variable keeps an override deterministic, where a second
 * radius utility in `className` would depend on Tailwind's emit order.
 */
const SURFACE_CLASSES = [
    'absolute isolate overflow-hidden',
    'rounded-[var(--app-card-radius,8px)]',
    '[background:var(--app-card-bg,rgba(23,23,23,0.05))]',
    'p-[var(--app-card-pad,24px)]',
    'backdrop-blur-[25px] backdrop-saturate-100',
    'border border-[rgba(82,82,82,0.2)]',
    'shadow-[0px_16px_60px_0_rgba(0,0,0,0.4),inset_0px_0px_4px_2px_rgba(255,255,255,0.1)]',
    'text-white',
    // Angled edge reflection.
    "before:content-[''] before:absolute before:inset-0 before:z-[1] before:rounded-[inherit] before:pointer-events-none",
    'before:[background:linear-gradient(to_left_top,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_50%)]',
    // Subtle top-to-bottom sheen.
    "after:content-[''] after:absolute after:inset-0 after:z-[1] after:rounded-[inherit] after:pointer-events-none",
    'after:[background:linear-gradient(to_bottom,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_100%)]'
].join(' ');

// z-[2] lifts the children above the z-[1] reflection overlays.
const CONTENT_CLASSES = [
    'relative z-[2] flex h-full w-full flex-col justify-between',
    '[text-shadow:0_1px_3px_rgba(0,0,0,0.2)]'
].join(' ');

export function AppCard({ children, className, style }: AppCardProps): JSX.Element {
    return (
        <div className={`${SURFACE_CLASSES} ${className ?? ''}`} style={style}>
            <div className={CONTENT_CLASSES}>{children}</div>
        </div>
    );
}

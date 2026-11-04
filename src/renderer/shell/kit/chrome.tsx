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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import type { SummonRequest, TileDefinition } from '../tile';
import { AppTile } from './app-tile';
import { DOME_PRESETS, PERSPECTIVE, SIZES, seedAt, tileIndexAt } from './dome';
import type { Pool } from './dome';
import { DomeEngine } from './engine';

const HIGHLIGHT_MS = 650;

/** One live tile per tile kind: the request that filled it and the slot it sits on. */
type LiveTiles = Record<string, { request: SummonRequest; slot: number }>;

export interface InfiniteGridProps {
    /** The registry. Slot (row, col) shows tiles[(row*5 + col*3) % tiles.length]. */
    tiles: readonly TileDefinition[];
    /** Rendered above the grid, with the function that summons a tile. */
    children?: (summon: (request: SummonRequest) => void) => ReactNode;
}

const STAGE_STYLE = {
    perspective: `${PERSPECTIVE}px`,
    touchAction: 'none',
    '--card-w': `${Math.round(SIZES.cardW)}px`,
    '--card-h': `${Math.round(SIZES.cardH)}px`
} as CSSProperties;

function useHighlight(): [number | null, (slot: number | null) => void] {
    const [highlight, setHighlight] = useState<number | null>(null);
    useEffect(() => {
        if (highlight === null) {
            return;
        }
        const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [highlight]);
    return [highlight, setHighlight];
}

/**
 * The live tiles, one per tile kind. A new pool re-flows the slots, so
 * every live tile moves to the nearest slot of its kind.
 */
function useLiveTiles(
    tiles: readonly TileDefinition[],
    nearestOf: (kind: number) => number | null
): [LiveTiles, (id: string, request: SummonRequest, slot: number) => void] {
    const [live, setLive] = useState<LiveTiles>({});
    useEffect(() => {
        setLive((current) => {
            const next: LiveTiles = {};
            for (const [id, entry] of Object.entries(current)) {
                const slot = nearestOf(tiles.findIndex((tile) => tile.id === id));
                next[id] = { ...entry, slot: slot! };
            }
            return next;
        });
    }, [nearestOf, tiles]);
    const place = useCallback((id: string, request: SummonRequest, slot: number) => {
        setLive((current) => ({ ...current, [id]: { request, slot } }));
    }, []);
    return [live, place];
}

/** One slot: the live tile when this slot holds it, the resting tile otherwise. */
function SlotContent({
    tile,
    slot,
    entry,
    mock,
    highlighted
}: {
    tile: TileDefinition;
    slot: number;
    entry: LiveTiles[string] | undefined;
    mock: ReactNode;
    highlighted: boolean;
}): JSX.Element {
    const { Live, liveKey, title } = tile;
    return (
        <div
            className={`h-full w-full ${highlighted ? 'ring-2 ring-white/80 ring-offset-0 rounded-[inherit]' : ''}`}
        >
            {Live && entry?.slot === slot ? (
                <Live
                    key={liveKey?.(entry.request.args) ?? tile.id}
                    label={title}
                    lowConfidence={entry.request.lowConfidence}
                    args={entry.request.args}
                />
            ) : (
                mock
            )}
        </div>
    );
}

interface Dome {
    pool: Pool;
    engine: DomeEngine;
    stageRef: (stage: HTMLDivElement) => () => void;
    cardRef: (card: HTMLDivElement) => () => void;
    kindAt: (slot: number) => number;
    nearestOf: (kind: number) => number | null;
}

/** The engine, its pool, and the refs that wire it to the stage and the cards. */
function useDome(tileCount: number, onInteract: () => void): Dome {
    const [pool, setPool] = useState<Pool>({ cols: 0, rows: 0 });
    const [engine] = useState(() => new DomeEngine(DOME_PRESETS.current, setPool, onInteract));

    const stageRef = useCallback((stage: HTMLDivElement) => engine.attach(stage), [engine]);
    const cardRef = useCallback(
        (card: HTMLDivElement) => {
            const slot = Number(card.dataset.index);
            engine.setCard(slot, card);
            return () => engine.setCard(slot, null);
        },
        [engine]
    );
    const kindAt = useCallback(
        (slot: number) => tileIndexAt(slot, pool, tileCount)!,
        [pool, tileCount]
    );
    const nearestOf = useCallback(
        (kind: number) => engine.nearest((slot) => kindAt(slot) === kind),
        [engine, kindAt]
    );
    return { pool, engine, stageRef, cardRef, kindAt, nearestOf };
}

/**
 * Summons a tile: reuse the slot it already lives on (the pool effect keeps
 * it valid), otherwise take the one nearest the center, so the flight is as
 * short as possible. Only a tile with a live version turns live.
 */
function useSummon(
    tiles: readonly TileDefinition[],
    { engine, nearestOf }: Dome,
    live: LiveTiles,
    place: (id: string, request: SummonRequest, slot: number) => void,
    setHighlight: (slot: number) => void
): (request: SummonRequest) => void {
    return useCallback(
        (request: SummonRequest) => {
            const kind = tiles.findIndex((tile) => tile.id === request.widget);
            if (kind < 0) {
                return;
            }
            const slot = live[request.widget]?.slot ?? nearestOf(kind)!;
            if (tiles[kind].Live) {
                place(request.widget, request, slot);
            }
            engine.centerOn(slot);
            setHighlight(slot);
        },
        [engine, live, nearestOf, place, setHighlight, tiles]
    );
}

/**
 * The dashboard: an infinite grid of glass tiles on a dome. Drag or wheel
 * to pan; a summoned tile flies to the center and, when it has a live
 * version, turns live.
 */
export function InfiniteGrid({ tiles, children }: InfiniteGridProps): JSX.Element {
    const [highlight, setHighlight] = useHighlight();
    const dome = useDome(tiles.length, () => setHighlight(null));
    const { pool, stageRef, cardRef, kindAt, nearestOf } = dome;
    const [live, place] = useLiveTiles(tiles, nearestOf);

    // The resting content per slot, memoized on the pool, so a re-render
    // hands the memoized AppTile the same children and skips every tile.
    const content = useMemo(
        () =>
            Array.from({ length: pool.cols * pool.rows }, (_, slot) => {
                const { Component } = tiles[kindAt(slot)];
                return <Component seed={seedAt(slot, pool)} />;
            }),
        [pool, tiles, kindAt]
    );

    const summon = useSummon(tiles, dome, live, place, setHighlight);

    return (
        <>
            <div
                ref={stageRef}
                className="grid-stage fixed inset-0 select-none overflow-hidden"
                style={STAGE_STYLE}
            >
                {content.map((mock, slot) => {
                    const tile = tiles[kindAt(slot)];
                    return (
                        <AppTile key={slot} ref={cardRef} index={slot}>
                            <SlotContent
                                tile={tile}
                                slot={slot}
                                entry={live[tile.id]}
                                mock={mock}
                                highlighted={highlight === slot}
                            />
                        </AppTile>
                    );
                })}
            </div>
            {children?.(summon)}
        </>
    );
}

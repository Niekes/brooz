import type { ComponentType } from 'react';

/**
 * The arguments an utterance can carry. The ask bar extracts all of them,
 * a tile's route keeps the ones it understands.
 */
export interface CommandArgs {
    city?: string;
    durationMinutes?: number;
    note?: string;
    query?: string;
    symbols?: string[];
    when?: 'today' | 'tomorrow' | 'this week' | 'next week';
    action?: 'open' | 'start' | 'pause' | 'reset' | 'play' | 'next';
}

/** A resolved utterance: which tile to activate, with what, and how sure. */
export interface SummonRequest {
    widget: string;
    args: CommandArgs;
    source: 'rules' | 'model';
    confidence: number;
    /** The router was not confident; the tile says so. */
    lowConfidence: boolean;
}

/** The resting state: a deterministic per-cell seed (0-999) for mock data. */
export interface TileProps {
    readonly seed: number;
}

/** A summoned tile: real data, configured by the utterance. */
export interface LiveTileProps {
    readonly label: string;
    readonly lowConfidence: boolean;
    readonly args: CommandArgs;
}

/**
 * How the ask bar finds a tile. The description is written for the local
 * model, the keywords and the pattern for the deterministic rules.
 */
export interface TileRoute {
    /** One sentence for the decision model, not for people. */
    readonly description: string;
    /** Lowercase English trigger words. */
    readonly keywords: readonly string[];
    /** Canonical utterances, shown as suggestions. */
    readonly examples: readonly string[];
    /** The rule that scores an utterance for this tile, and its weight. */
    readonly pattern: RegExp;
    readonly weight: number;
    /** Keeps the args that matter to this tile; none when absent. */
    readonly args?: (args: CommandArgs) => CommandArgs;
}

/**
 * One kind of cell of the dashboard grid. `Component` is the resting tile,
 * seeded from its position. A tile with `Live` turns into a real one when
 * the ask bar summons it; `liveKey` decides when that live tile remounts.
 * A tile keeps its state to itself and talks to the main process through
 * `window.brooz`.
 */
export interface TileDefinition {
    readonly id: string;
    readonly title: string;
    readonly Component: ComponentType<TileProps>;
    readonly Live?: ComponentType<LiveTileProps>;
    readonly liveKey?: (args: CommandArgs) => string;
    readonly route?: TileRoute;
}

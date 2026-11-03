import type { ComponentType } from 'react';
import type { IpcChannel } from '../../shared/ipc';
import type { ProviderInfo, ProviderOutcome } from '../../shared/providers';
import type { AsyncView } from './kit/live';

/**
 * The arguments an utterance can carry. The ask bar extracts all of them,
 * a tile's route keeps the ones it understands.
 */
export interface CommandArgs {
    city?: string;
    symbols?: string[];
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
export interface LiveTileProps<T> {
    readonly args: CommandArgs;
    /** The live data, already unwrapped from the provider outcome by the shell. */
    readonly data: T;
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

/** One provider a live tile can be served by, and the channel it serves it through. */
export interface TileProvider {
    readonly provider: ProviderInfo;
    readonly channel: IpcChannel;
}

/**
 * What a live tile loads before the shell can show it: the provider outcome
 * of the chosen provider's channel, plus the two states that never reach
 * the network - the location is still being resolved, or a setting the
 * tile needs is missing.
 */
export interface LiveLoader<T> {
    readonly pending: boolean;
    readonly notice: string | null;
    readonly state: AsyncView<ProviderOutcome<T>>;
}

/**
 * One kind of cell of the dashboard grid. `Component` is the resting tile,
 * seeded from its position. A tile with `Live` turns into a real one when
 * the ask bar summons it; `liveKey` decides when that live tile remounts.
 * The shell owns the live chrome - status row, loading, error, missing key -
 * so `Live` only renders its content from the unwrapped `data` and
 * `useLiveData` only loads it. A tile keeps its state to itself and talks
 * to the main process through `window.brooz`.
 */
export interface TileDefinition<T = unknown> {
    readonly id: string;
    readonly title: string;
    readonly Component: ComponentType<TileProps>;
    // `any` keeps the registry heterogeneous: a tile's Live is typed at its own declaration.
    readonly Live?: ComponentType<LiveTileProps<any>>;
    readonly liveKey?: (args: CommandArgs) => string;
    readonly route?: TileRoute;
    /** The providers whose keys the live tile can use; the first is the default. */
    readonly providers?: readonly TileProvider[];
    /**
     * Loads the live data over the chosen provider's channel. The shell calls
     * it while the tile is summoned, so it may use hooks; a live tile always
     * has a provider.
     */
    readonly liveData?: (args: CommandArgs, channel: IpcChannel) => LiveLoader<T>;
}

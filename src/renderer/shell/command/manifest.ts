import { tiles } from '../../tiles';
import type { CommandArgs, TileDefinition, TileRoute } from '../tile';

/** A tile the ask bar can route to. */
export type RoutedTile = TileDefinition & { readonly route: TileRoute };

/**
 * The machine-readable side of the dashboard, derived from the registry:
 * every tile with a route, in registry order. The rules read the keywords
 * and patterns, the local model the ids and descriptions.
 */
export const ROUTED_TILES: readonly RoutedTile[] = tiles.filter(
    (tile): tile is RoutedTile => tile.route !== undefined
);

export function routedTile(id: string): RoutedTile | undefined {
    return ROUTED_TILES.find((tile) => tile.id === id);
}

/** Keeps only the args that matter to the chosen tile. */
export function argsFor(id: string, args: CommandArgs): CommandArgs {
    return routedTile(id)?.route.args?.(args) ?? {};
}

import { aboutTile } from './about';
import type { TileDefinition } from '../shell/tile';

/**
 * The registry: every tile of the dashboard, in display order. A tile that
 * is missing here is dead code - fallow reports its unused export.
 */
export const tiles: readonly TileDefinition[] = [aboutTile];

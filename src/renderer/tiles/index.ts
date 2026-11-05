import { aboutTile } from './about';
import { airQualityTile } from './airQuality';
import { flightrackerTile } from './flightracker';
import { surfTile } from './surf';
import { tickerTile } from './ticker';
import { weatherTile } from './weather';
import type { TileDefinition } from '../shell/tile';

/**
 * The registry: every tile of the dashboard. The slots nearest the pool's
 * center carry the tiles in this order; every other slot shows the default
 * tile (docs/adr/0009). A tile that is missing here is dead code - fallow
 * reports its unused export.
 */
export const tiles: readonly TileDefinition[] = [
    weatherTile,
    airQualityTile,
    tickerTile,
    surfTile,
    flightrackerTile,
    aboutTile
];

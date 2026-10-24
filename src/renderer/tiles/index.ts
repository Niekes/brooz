import { aboutTile } from './about';
import { activityRingsTile } from './activityRings';
import { airQualityTile } from './airQuality';
import { analogClockTile } from './analogClock';
import { calendarTile } from './calendar';
import { forecastTile } from './forecast';
import { moonPhaseTile } from './moonPhase';
import { nowPlayingTile } from './nowPlaying';
import { photoTile } from './photo';
import { pomodoroTile } from './pomodoro';
import { stickyNoteTile } from './stickyNote';
import { systemStatsTile } from './systemStats';
import { tickerTile } from './ticker';
import { weatherTile } from './weather';
import { worldClockTile } from './worldClock';
import type { TileDefinition } from '../shell/tile';

/**
 * The registry: every tile of the dashboard. The order is the grid's
 * pattern, slot (row, col) shows tiles[(row * 5 + col * 3) % tiles.length].
 * A tile that is missing here is dead code - fallow reports its unused
 * export.
 */
export const tiles: readonly TileDefinition[] = [
    analogClockTile,
    worldClockTile,
    weatherTile,
    forecastTile,
    nowPlayingTile,
    activityRingsTile,
    systemStatsTile,
    tickerTile,
    calendarTile,
    pomodoroTile,
    moonPhaseTile,
    airQualityTile,
    stickyNoteTile,
    photoTile,
    aboutTile
];

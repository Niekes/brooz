import type { JSX } from 'react';
import { tiles } from '../../tiles';
import { START_TILE_KEY, useStartTile } from '../kit/stored';

/**
 * The start tile: the one the dashboard centers and highlights on launch
 * (docs/adr/0015). About until the person picks another; a stored id that is
 * no longer registered falls back to About at the grid.
 */
export function StartTileOption(): JSX.Element {
    const [start, setStart] = useStartTile();
    return (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/2 p-4 text-sm">
            <legend className="px-1 text-white">Start tile</legend>
            <p className="text-xs text-white/50">
                The tile the dashboard centers on when it opens. It is highlighted, not summoned
                live.
            </p>
            {tiles.map((tile) => (
                <label key={tile.id} className="flex items-center gap-3 text-white/80">
                    <input
                        type="radio"
                        name={START_TILE_KEY}
                        checked={start === tile.id}
                        onChange={() => setStart(tile.id)}
                        className="accent-white"
                    />
                    {tile.title}
                </label>
            ))}
        </fieldset>
    );
}

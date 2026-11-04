import type { JSX } from 'react';
import type { ProviderInfo } from '../../../shared/providers';
import { useStoredValue } from '../kit/browser';
import { chosenProviderKey } from '../kit/stored';
import type { TileDefinition } from '../tile';

/**
 * One radio of a tile's provider picker: the tile uses this provider when it
 * is chosen. The radios of a tile share one name, so the choice is per tile.
 */
function TileChoice({
    provider,
    tile
}: {
    provider: ProviderInfo;
    tile: TileDefinition;
}): JSX.Element {
    const [chosen, setChosen] = useStoredValue<string | null>(chosenProviderKey(tile.id), null);
    const fallback = tile.providers?.[0]?.provider.id;
    const active = (chosen ?? fallback) === provider.id;
    return (
        <label className="flex items-center gap-3 text-white/80">
            <input
                type="radio"
                name={`tile-provider-${tile.id}`}
                checked={active}
                onChange={() => setChosen(provider.id)}
                className="accent-white"
            />
            {provider.title}
        </label>
    );
}

/**
 * The provider picker of a tile's settings section: one radio per candidate
 * provider. A tile with a single candidate has nothing to choose, so it
 * shows no radio (docs/adr/0011).
 */
export function TileProviderChoice({ tile }: { tile: TileDefinition }): JSX.Element | null {
    const candidates = tile.providers ?? [];
    if (candidates.length <= 1) {
        return null;
    }
    return (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/2 p-4 text-sm">
            <legend className="px-1 text-white">Provider</legend>
            {candidates.map((candidate) => (
                <TileChoice key={candidate.provider.id} provider={candidate.provider} tile={tile} />
            ))}
        </fieldset>
    );
}

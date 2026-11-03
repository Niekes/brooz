import type { JSX } from 'react';
import type { ProviderInfo } from '../../../shared/providers';
import { useStoredValue } from '../kit/browser';
import { chosenProviderKey } from '../kit/hooks';
import type { TileDefinition } from '../tile';

/**
 * One radio of the provider picker: the tile uses this provider when it is
 * chosen. The radios of a tile share one name across the provider sections,
 * so the sections stay keyed by provider while the choice is per tile.
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
            {tile.title} uses {provider.title}
        </label>
    );
}

/**
 * The provider picker of a provider's settings section: one radio per served
 * tile that can choose between several providers. A tile with a single
 * candidate has nothing to choose, so it shows no radio.
 */
export function ProviderChoice({
    provider,
    tiles
}: {
    provider: ProviderInfo;
    tiles: readonly TileDefinition[];
}): JSX.Element | null {
    // The caller passes only the tiles this provider serves.
    const choosable = tiles.filter((tile) => (tile.providers?.length ?? 0) > 1);
    if (choosable.length === 0) {
        return null;
    }
    return (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/2 p-4 text-sm">
            <legend className="px-1 text-white">Tiles using this provider</legend>
            {choosable.map((tile) => (
                <TileChoice key={tile.id} provider={provider} tile={tile} />
            ))}
        </fieldset>
    );
}

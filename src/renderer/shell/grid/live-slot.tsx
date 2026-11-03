import type { JSX } from 'react';
import { useChosenProvider } from '../kit/stored';
import { LiveFrame, NeedsSetting, ProviderData } from '../kit/live';
import type { SummonRequest, TileDefinition } from '../tile';

/**
 * A summoned tile. The shell owns the chrome - the status row with the tile
 * name, the chosen provider and the low-confidence badge, and the loading,
 * error and missing-key overlays - while the tile's `Live` renders only its
 * content from the unwrapped data (docs/adr/0010).
 */
export function LiveSlot({
    tile,
    request
}: {
    tile: TileDefinition;
    request: SummonRequest;
}): JSX.Element | null {
    const chosen = useChosenProvider(tile);
    // Called whenever the tile declares a loader, before any early return, so
    // the hook order of this slot stays stable; the slot is keyed by tile id.
    const loader =
        chosen && tile.liveData ? tile.liveData(request.args, chosen.channel) : undefined;
    const Live = tile.Live;
    if (!chosen || !loader || !Live) {
        // A live tile always has a provider; the create-tile skill asks for one.
        return null;
    }
    const label = tile.title;
    const lowConfidence = request.lowConfidence;
    const key = tile.liveKey?.(request.args) ?? tile.id;
    if (loader.notice) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <NeedsSetting message={loader.notice} />
            </LiveFrame>
        );
    }
    return (
        <ProviderData
            label={label}
            lowConfidence={lowConfidence}
            provider={chosen.provider}
            pending={loader.pending}
            state={loader.state}
        >
            {(data) => <Live key={key} args={request.args} data={data} />}
        </ProviderData>
    );
}

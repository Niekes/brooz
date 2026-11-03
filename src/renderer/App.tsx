import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { CommandBar } from './shell/command/command-bar';
import { Backdrop } from './shell/glass/backdrop';
import { InfiniteGrid } from './shell/grid/infinite-grid';
import { Settings, useSettingsShortcut } from './shell/settings/settings';
import { tiles } from './tiles';

/**
 * The dashboard shell: the backdrop, the infinite grid of every registered
 * tile, the ask bar that summons a tile onto it, and the settings over it.
 */
export function App(): JSX.Element {
    const [settingsOpen, setSettingsOpen] = useState(false);
    useSettingsShortcut(useCallback(() => setSettingsOpen((open) => !open), []));

    return (
        <>
            <Backdrop />
            <InfiniteGrid tiles={tiles} onOpenSettings={() => setSettingsOpen(true)}>
                {(summon) => (
                    <CommandBar onSummon={summon} onOpenSettings={() => setSettingsOpen(true)} />
                )}
            </InfiniteGrid>
            <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    );
}

import type { JSX } from 'react';
import { CommandBar } from './shell/command/command-bar';
import { Backdrop } from './shell/glass/backdrop';
import { InfiniteGrid } from './shell/grid/infinite-grid';
import { tiles } from './tiles';

/**
 * The dashboard shell: the backdrop, the infinite grid of every registered
 * tile, and the ask bar that summons a tile onto it.
 */
export function App(): JSX.Element {
    return (
        <>
            <Backdrop />
            <InfiniteGrid tiles={tiles}>
                {(summon) => <CommandBar onSummon={summon} />}
            </InfiniteGrid>
        </>
    );
}

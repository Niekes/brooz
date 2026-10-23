import type { ComponentType } from 'react';

/**
 * One cell of the dashboard grid. `Component` takes no props: a tile keeps
 * its state to itself and talks to the main process through `window.brooz`.
 */
export interface TileDefinition {
    readonly id: string;
    readonly title: string;
    readonly Component: ComponentType;
}

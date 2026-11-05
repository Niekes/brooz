import { useStoredValue } from '../kit/browser';
import { ROUTED_TILES } from './manifest';

/** A saved utterance with a label; without a label the utterance shows (docs/adr/0017). */
export interface QuickAction {
    readonly label: string;
    readonly utterance: string;
}

/** The row above the ask bar wraps; more than this would grow into the dome. */
export const MAX_QUICK_ACTIONS = 8;

/** Until the person changes the list: the first example of every routed live tile. */
const DEFAULTS: readonly QuickAction[] = ROUTED_TILES.filter((tile) => tile.Live !== undefined).map(
    (tile) => ({ label: '', utterance: tile.route.examples[0] })
);

/**
 * The quick actions: the defaults until the person changes the list, then
 * only theirs - an empty list stays empty, and a tile added later never
 * joins a list the person made.
 */
export function useQuickActions(): [readonly QuickAction[], (actions: QuickAction[]) => void] {
    const [stored, setStored] = useStoredValue<QuickAction[] | null>('brooz.quick-actions', null);
    return [stored ?? DEFAULTS, setStored];
}

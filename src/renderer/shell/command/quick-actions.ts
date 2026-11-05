import { useStoredValue } from '../kit/browser';
import { ROUTED_TILES } from './manifest';

/*
 * The quick actions live beside the manifest rather than in `kit/stored.ts`:
 * their defaults come from the registry, which the kit never imports.
 */

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

/** Whether a value can be a quick action: a string label and an utterance that is not blank. */
export function isQuickAction(entry: unknown): entry is QuickAction {
    const { label, utterance } = (entry ?? {}) as Partial<Record<keyof QuickAction, unknown>>;
    return typeof label === 'string' && typeof utterance === 'string' && utterance.trim() !== '';
}

/**
 * The quick actions: the defaults until the person changes the list, then
 * only theirs - an empty list stays empty, and a tile added later never
 * joins a list the person made. A stored value that is no list reads as
 * the defaults; more than eight are cut.
 */
export function useQuickActions(): [readonly QuickAction[], (actions: QuickAction[]) => void] {
    const [stored, setStored] = useStoredValue<unknown>('brooz.ask.quick-actions', null);
    const actions = Array.isArray(stored) ? stored.filter(isQuickAction) : DEFAULTS;
    return [actions.slice(0, MAX_QUICK_ACTIONS), setStored];
}

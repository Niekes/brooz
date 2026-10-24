import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { SummonRequest } from '../tile';
import { isLowConfidence } from './command-parts';
import type { CommandMatch } from './parse';
import type { ModelStatus } from './use-local-model';

/** Pause after the last keystroke before a confident route activates its tile. */
const AUTO_SUMMON_DELAY = 400;
const NOTICE_MS = 6000;

/** Cmd+K or Ctrl+K focuses the field from anywhere. */
export function useFocusShortcut(input: RefObject<HTMLInputElement | null>): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                input.current!.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [input]);
}

/** A message that goes away on its own after a while. */
export function useNotice(): [string | null, (notice: string) => void] {
    const [notice, setNotice] = useState<string | null>(null);
    useEffect(() => {
        if (!notice) {
            return;
        }
        const id = setTimeout(() => setNotice(null), NOTICE_MS);
        return () => clearTimeout(id);
    }, [notice]);
    return [notice, setNotice];
}

/**
 * Auto-summon: a confident route summons its tile after a short pause. It
 * sends the tile alone; city, duration and note wait for Enter, so the tile
 * shows its default instead of half-typed input. A tile is summoned once
 * per streak of typing, and never after a chip filled the field.
 */
export function useAutoSummon(
    query: string,
    active: CommandMatch | undefined,
    suppress: RefObject<boolean>,
    last: RefObject<string | null>,
    onSummon: (request: SummonRequest) => void
): void {
    // The match object is rebuilt on every keystroke; its fields decide.
    const widget = active && !isLowConfidence(active) ? active.widget : null;
    const source = active?.source;
    const confidence = active?.confidence;
    useEffect(() => {
        if (suppress.current || !widget || last.current === widget) {
            return;
        }
        const timer = setTimeout(() => {
            last.current = widget;
            onSummon({
                widget,
                args: {},
                source: source!,
                confidence: confidence!,
                lowConfidence: false
            });
        }, AUTO_SUMMON_DELAY);
        return () => clearTimeout(timer);
    }, [query, widget, source, confidence, suppress, last, onSummon]);
}

/** Starts loading the local model as soon as the bar is there. */
export function useModelWarmup(status: ModelStatus, load: () => void): void {
    useEffect(() => {
        if (status === 'idle') {
            load();
        }
    }, [status, load]);
}

/** The line under the field: a notice, a warning, a failure or the keys. */
export function hintFor(
    notice: string | null,
    lowConfidence: boolean,
    failure: string | null
): string {
    if (notice) {
        return notice;
    }
    if (lowConfidence) {
        return 'Low confidence — the top result opens anyway';
    }
    return failure ?? '↑↓ select · Enter open · Esc clears';
}

/** Why the list is empty while the model is busy; empty when it is not. */
export function waitingText(status: ModelStatus, pending: boolean): string {
    if (status === 'loading') {
        return 'Loading the local model… rules are still available.';
    }
    return pending ? 'Thinking with the local model…' : '';
}

import { useCallback, useEffect, useState } from 'react';
import { argsFor } from './manifest';
import { parseCommand } from './parse';
import type { CommandMatch } from './parse';
import { rankedWidgets } from './route-intent';
import type { RouteResult } from './route-intent';
import type { ModelStatus } from './use-local-model';

/** Pause after the last keystroke before the model is asked. */
const MODEL_DELAY = 240;

export interface ModelRouting {
    /** The model's answer first, then up to two runners-up. */
    matches: CommandMatch[];
    pending: boolean;
    failure: string | null;
    reset: () => void;
}

function toMatches(result: RouteResult, query: string): CommandMatch[] {
    const { args } = parseCommand(query);
    const match = (widget: string, confidence: number): CommandMatch => ({
        widget,
        confidence,
        args: argsFor(widget, args),
        source: 'model'
    });
    const alternatives = rankedWidgets(result.probabilities, 5)
        .filter((entry) => entry.widget !== result.widget)
        .slice(0, 2)
        .map((entry) => match(entry.widget, entry.probability));
    return [match(result.widget, result.confidence), ...alternatives];
}

/**
 * Asks the local model about the query once typing pauses. A newer query
 * makes every older answer stale.
 */
export function useModelRouting(
    query: string,
    status: ModelStatus,
    route: (text: string) => Promise<RouteResult>
): ModelRouting {
    const [matches, setMatches] = useState<CommandMatch[]>([]);
    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
        const text = query.trim();
        if (status !== 'ready' || text.length < 2) {
            return;
        }
        let stale = false;
        const timer = setTimeout(() => {
            setPending(true);
            route(text)
                .then(
                    (result) => {
                        if (!stale) {
                            setMatches(toMatches(result, query));
                        }
                    },
                    (cause: Error) => {
                        if (!stale) {
                            setFailure(cause.message);
                        }
                    }
                )
                .finally(() => {
                    if (!stale) {
                        setPending(false);
                    }
                });
        }, MODEL_DELAY);
        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [query, status, route]);

    const reset = useCallback(() => {
        setMatches([]);
        setFailure(null);
        setPending(false);
    }, []);

    return { matches, pending, failure, reset };
}

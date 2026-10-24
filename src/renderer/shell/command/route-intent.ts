import type { OpenJev } from 'open-jev';

export interface RouteResult {
    widget: string;
    /** Probability of the winning tile (`0..1`). */
    confidence: number;
    /** The full distribution over every routed tile. */
    probabilities: Record<string, number>;
    latencyMs: number;
}

/** The options of the one question the model answers: tile ids and their descriptions. */
export interface RouteOptions {
    ids: string[];
    descriptions: Record<string, string>;
}

/**
 * Routes one English utterance to a tile: one typed question, one forward
 * pass. The descriptions are what separates Weather from Forecast from Air
 * Quality; a bare id is not enough for a model this small.
 */
export async function routeIntent(
    jev: OpenJev,
    text: string,
    { ids, descriptions }: RouteOptions
): Promise<RouteResult> {
    const started = performance.now();
    const answer = await jev.decide(text, {
        widget: {
            type: 'choice',
            instructions: 'Which dashboard widget should handle this request?',
            options: ids,
            descriptions
        }
    });
    const { choice, confidence, probabilities } = answer.widget;
    return { widget: choice, confidence, probabilities, latencyMs: performance.now() - started };
}

/** The most probable tiles first. */
export function rankedWidgets(
    probabilities: Record<string, number>,
    limit: number
): Array<{ widget: string; probability: number }> {
    return Object.entries(probabilities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([widget, probability]) => ({ widget, probability }));
}

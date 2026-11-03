import type { CommandArgs } from '../tile';
import { ROUTED_TILES, argsFor } from './manifest';

export interface CommandMatch {
    widget: string;
    confidence: number;
    args: CommandArgs;
    source: 'rules' | 'model';
}

export interface ParseResult {
    best: CommandMatch | null;
    matches: CommandMatch[];
    /** Args extracted from the text, whichever tile wins. */
    args: CommandArgs;
}

const SYMBOLS: Record<string, string> = {
    apple: 'AAPL',
    tesla: 'TSLA',
    nvidia: 'NVDA',
    microsoft: 'MSFT',
    amazon: 'AMZN',
    google: 'GOOGL',
    meta: 'META',
    bitcoin: 'BTC-USD',
    ethereum: 'ETH-USD'
};

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasPhrase(text: string, phrase: string): boolean {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
}

function titleCase(value: string): string {
    return value
        .split(' ')
        .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

const CITY_PATTERN =
    /\b(?:in|for|at)\s+([A-Za-z][A-Za-z'’.-]*(?:\s+(?:of\s+)?[A-Za-z][A-Za-z'’.-]*){0,2})/gi;
const CITY_TAIL =
    /\b(?:today|tonight|tomorrow|right now|now|please|this weekend|next week|this week|this morning|this evening|this afternoon|at night)\b.*$/i;
const NOT_A_CITY = [
    /^(?:the|my|a|an|this|next)\b/i,
    /^(?:minutes?|hours?|week|weekend|morning|evening|night)$/i
];

function cityCandidate(match: string): string | undefined {
    // "in Berlin and London" -> Berlin. Good enough for one-city tiles.
    const candidate = match
        .replace(CITY_TAIL, '')
        .trim()
        .split(/\s+and\s+/i)[0];
    if (!candidate || NOT_A_CITY.some((pattern) => pattern.test(candidate))) {
        return undefined;
    }
    return candidate;
}

/**
 * Pulls a city out of "in Rome", "for Berlin", "at New York". The last valid
 * prepositional object wins: "weather at noon, in Oslo" is Oslo.
 */
function extractCity(raw: string): string | undefined {
    const text = raw.replace(/\s+/g, ' ').trim();
    const candidates = [...text.matchAll(CITY_PATTERN)].flatMap((match) => {
        const candidate = cityCandidate(match[1]);
        return candidate ? [candidate] : [];
    });
    return candidates.length > 0 ? titleCase(candidates[candidates.length - 1]) : undefined;
}

function extractSymbols(raw: string): string[] | undefined {
    const text = normalize(raw);
    const symbols = new Set<string>();
    for (const [name, symbol] of Object.entries(SYMBOLS)) {
        if (hasPhrase(text, name)) {
            symbols.add(symbol);
        }
    }
    for (const token of raw.match(/\b[A-Z]{1,5}\b/g) ?? []) {
        if (token !== 'I' && token !== 'A') {
            symbols.add(token);
        }
    }
    return symbols.size > 0 ? [...symbols] : undefined;
}

function scoreTiles(text: string): Array<[string, number]> {
    const scores: Array<[string, number]> = [];
    for (const { id, route } of ROUTED_TILES) {
        let score = route.pattern.test(text) ? route.weight : 0;
        for (const keyword of route.keywords) {
            if (hasPhrase(text, keyword)) {
                score += 1 + keyword.length / 10;
            }
        }
        if (score > 0) {
            scores.push([id, score]);
        }
    }
    return scores.sort((a, b) => b[1] - a[1]);
}

/**
 * The top option is judged against its runner-up; lower options are also
 * capped by how far they trail the option above, so ties all look uncertain.
 */
function confidenceAt(ranked: Array<[string, number]>, index: number): number {
    const score = ranked[index][1];
    const following = ranked[index + 1]?.[1] ?? 0;
    const previous = index === 0 ? Infinity : ranked[index - 1][1];
    const margin = Math.min(score - following, previous - score);
    return Math.min(0.95, 0.55 + Math.max(0, Math.min(margin, 4)) * 0.1);
}

/**
 * The fast, local, deterministic first pass. It never touches the network
 * and never loads a model; it only needs the registry.
 */
export function parseCommand(raw: string): ParseResult {
    const args: CommandArgs = {
        city: extractCity(raw),
        symbols: extractSymbols(raw)
    };

    const ranked = scoreTiles(normalize(raw));
    const matches = ranked.slice(0, 3).map(([widget], index): CommandMatch => ({
        widget,
        confidence: confidenceAt(ranked, index),
        args: argsFor(widget, args),
        source: 'rules'
    }));

    return { best: matches[0] ?? null, matches, args };
}

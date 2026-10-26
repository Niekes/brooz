import { createHash } from 'node:crypto';
import { net } from 'electron';
import type { ProviderOutcome, ProviderProbe } from '../shared/providers';
import type { StockQuote } from '../shared/quotes';

/**
 * Finnhub, the provider of the markets tiles. The main process calls it with
 * the provider's key in the query; the renderer never sees one
 * (`docs/adr/0001-provider-keys-never-reach-the-renderer.md`). Quotes are
 * cached in memory for a minute: switching back to a tile does not refetch
 * the same ticker.
 */

interface QuoteRaw {
    /** The current price. */
    c: number;
    /** The day's change in percent, or null when the service has none. */
    dp: number | null;
}

const QUOTE_TTL = 1000 * 60;
const MAX_ENTRIES = 100;
/** A request that has not answered by then is given up. */
const REQUEST_TIMEOUT = 10_000;
/** The symbol the settings' "test" call checks a key against. */
const PROBE_SYMBOL = 'AAPL';

/** How the symbols the renderer writes are spelled at Finnhub. */
const CRYPTO: Record<string, string> = {
    'BTC-USD': 'BINANCE:BTCUSDT',
    'ETH-USD': 'BINANCE:ETHUSDT'
};

const cache = new Map<string, { at: number; quote: StockQuote }>();

/**
 * The cache slot of a quote. The key identifies its slot without living in
 * it: no plaintext key is kept in memory past the call
 * (`docs/adr/0002-safe-storage-fail-closed.md`), and a rotated key misses
 * the cache instead of serving the old key's quotes.
 */
function cacheKeyOf(key: string, symbol: string): string {
    const hashed = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return `${hashed}:${symbol}`;
}

function quoteUrl(key: string, symbol: string): URL {
    const url = new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol', CRYPTO[symbol] ?? symbol);
    url.searchParams.set('token', key);
    return url;
}

async function fetchQuote(key: string, symbol: string): Promise<StockQuote> {
    const cacheKey = cacheKeyOf(key, symbol);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at <= QUOTE_TTL) {
        return cached.quote;
    }

    const response = await net
        .fetch(quoteUrl(key, symbol).toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
        .catch((cause: unknown) => {
            if (cause instanceof DOMException && cause.name === 'TimeoutError') {
                throw new Error('Finnhub did not answer in time.');
            }
            throw cause;
        });
    if (!response.ok) {
        throw new Error(`Finnhub replied with ${response.status}.`);
    }
    const raw = (await response.json()) as QuoteRaw;

    const now = Date.now();
    for (const [stored, entry] of cache) {
        if (now - entry.at > QUOTE_TTL) {
            cache.delete(stored);
        }
    }
    cache.delete(cacheKey);
    cache.set(cacheKey, { at: now, quote: { symbol, price: raw.c, changePercent: raw.dp } });
    if (cache.size > MAX_ENTRIES) {
        cache.delete(cache.keys().next().value!);
    }
    return { symbol, price: raw.c, changePercent: raw.dp };
}

function message(cause: unknown): string {
    return cause instanceof Error ? cause.message : 'Finnhub could not be reached.';
}

/** Quotes the symbols, or the provider's own error - never a throw. */
export async function fetchQuotes(
    key: string,
    symbols: readonly string[]
): Promise<ProviderOutcome<StockQuote[]>> {
    try {
        const data = await Promise.all(symbols.map((symbol) => fetchQuote(key, symbol)));
        return { status: 'ok', data };
    } catch (cause) {
        return { status: 'provider-error', message: message(cause) };
    }
}

/** Checks a key against the service with one known symbol. */
export async function probeKey(key: string): Promise<ProviderProbe> {
    try {
        await fetchQuote(key, PROBE_SYMBOL);
        return { status: 'ok' };
    } catch (cause) {
        return { status: 'provider-error', message: message(cause) };
    }
}

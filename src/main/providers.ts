import { FINNHUB } from '../shared/providers';
import type {
    MissingKeyReason,
    ProviderId,
    ProviderOutcome,
    ProviderProbe
} from '../shared/providers';
import type { StockQuote } from '../shared/quotes';
import { fetchQuotes, probeKey } from './finnhub';
import { canStoreKeys, providerKey } from './key-store';

/**
 * The provider side of the contract, and the only code that reads a stored
 * key. A missing key never reaches a service: the channel answers with the
 * missing-key union, so the tile invites to the settings instead of failing.
 */

/** Why a key reads as missing: never set, or this OS cannot store keys. */
export function missingKeyReason(): MissingKeyReason {
    return canStoreKeys() ? 'not-set' : 'encryption-unavailable';
}

/** Quotes the symbols through the provider, with the provider's key. */
export async function stockQuotes(
    symbols: readonly string[]
): Promise<ProviderOutcome<StockQuote[]>> {
    const key = providerKey(FINNHUB.id);
    if (key === null) {
        return { status: 'missing-key', reason: missingKeyReason() };
    }
    return fetchQuotes(key, symbols);
}

/** Checks the provider's stored key against its service, for the settings. */
export async function probeProvider(provider: ProviderId): Promise<ProviderProbe> {
    const key = providerKey(provider);
    if (key === null) {
        return { status: 'missing-key', reason: missingKeyReason() };
    }
    return probeKey(key);
}

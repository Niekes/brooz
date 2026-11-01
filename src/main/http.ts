import { net } from 'electron';

/**
 * What the keyless and the keyed weather services share: a JSON request
 * that gives up after ten seconds, and a small in-memory cache, so
 * switching between live tiles does not refetch the same place.
 */

/** A request that has not answered by then is given up. */
const REQUEST_TIMEOUT = 10_000;
const MAX_ENTRIES = 100;

/**
 * Fetches JSON from `service`. A status that is not ok becomes an error
 * whose message `rejected` words, so a provider can explain its own codes.
 */
export async function fetchJson<T>(
    url: URL,
    service: string,
    rejected: (status: number) => string = (status) => `${service} replied with ${status}.`
): Promise<T> {
    const response = await net
        .fetch(url.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
        .catch((cause: unknown) => {
            if (cause instanceof DOMException && cause.name === 'TimeoutError') {
                throw new Error(`${service} did not answer in time.`);
            }
            throw cause;
        });
    if (!response.ok) {
        throw new Error(rejected(response.status));
    }
    return (await response.json()) as T;
}

export interface Cache {
    read<T>(key: string): T | undefined;
    write<T>(key: string, value: T): T;
}

/**
 * A cache whose entries live for `maxAge` milliseconds. Expired entries go
 * on every write, and it never holds more than a hundred: a Map iterates in
 * insertion order, so the first key is the oldest.
 */
export function createCache(maxAge: number): Cache {
    const entries = new Map<string, { at: number; value: unknown }>();
    return {
        read<T>(key: string): T | undefined {
            const entry = entries.get(key);
            if (entry && Date.now() - entry.at <= maxAge) {
                return entry.value as T;
            }
            entries.delete(key);
            return undefined;
        },
        write<T>(key: string, value: T): T {
            const now = Date.now();
            for (const [stored, entry] of entries) {
                if (now - entry.at > maxAge) {
                    entries.delete(stored);
                }
            }
            entries.delete(key);
            entries.set(key, { at: now, value });
            if (entries.size > MAX_ENTRIES) {
                entries.delete(entries.keys().next().value!);
            }
            return value;
        }
    };
}

/**
 * Seeded mock data. Every resting tile derives its values from the seed of
 * its grid cell, so the same cell always shows the same thing and no tile
 * needs Math.random, Date or a timer.
 */

/** Deterministic pick: the Math.random replacement for seeded mock data. */
export function pick<T>(seed: number, items: readonly T[]): T {
    return items[Math.abs(seed) % items.length];
}

/** mulberry32: a tiny deterministic PRNG for series data (bars, sparklines). */
export function rng(seed: number): () => number {
    let a = Math.abs(seed) >>> 0 || 1;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

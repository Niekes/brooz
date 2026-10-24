/**
 * Seeded mock data. Every resting tile derives its values from the seed of
 * its grid cell, so the same cell always shows the same thing and no tile
 * needs Math.random, Date or a timer.
 */

/**
 * One accent hue per tile instance. `text` is a literal Tailwind class,
 * because Tailwind cannot see dynamically built class names; `hex` is for
 * inline styles and SVG attributes.
 */
export interface Hue {
    hex: string;
    text: string;
}

export const HUES: readonly Hue[] = [
    { hex: '#7dd3fc', text: 'text-[#7dd3fc]' },
    { hex: '#a78bfa', text: 'text-[#a78bfa]' },
    { hex: '#fcd34d', text: 'text-[#fcd34d]' },
    { hex: '#fda4af', text: 'text-[#fda4af]' },
    { hex: '#5eead4', text: 'text-[#5eead4]' },
    { hex: '#bef264', text: 'text-[#bef264]' },
    { hex: '#93c5fd', text: 'text-[#93c5fd]' },
    { hex: '#fdba74', text: 'text-[#fdba74]' }
];

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

/** `HH:MM` from hours and minutes. */
export function clock(hours: number, minutes: number): string {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

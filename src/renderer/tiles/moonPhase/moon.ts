/**
 * Local moon-phase math: no API, no network. Based on the synodic month and
 * a known new moon (2000-01-06 18:14 UTC). Accurate to within a few hours,
 * far more than a dashboard needs.
 */

const SYNODIC_MONTH = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

const PHASES = [
    { name: 'New Moon', emoji: '🌑' },
    { name: 'Waxing Crescent', emoji: '🌒' },
    { name: 'First Quarter', emoji: '🌓' },
    { name: 'Waxing Gibbous', emoji: '🌔' },
    { name: 'Full Moon', emoji: '🌕' },
    { name: 'Waning Gibbous', emoji: '🌖' },
    { name: 'Last Quarter', emoji: '🌗' },
    { name: 'Waning Crescent', emoji: '🌘' }
] as const;

export interface MoonPhase {
    name: string;
    emoji: string;
    /** 0..1 illuminated fraction of the disc. */
    illumination: number;
    waxing: boolean;
    nextFullMoon: Date;
    daysUntilFull: number;
}

export function getMoonPhase(date: Date): MoonPhase {
    const days = (date.getTime() - KNOWN_NEW_MOON) / DAY_MS;
    const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
    const fraction = age / SYNODIC_MONTH;
    const phase = PHASES[Math.floor(((fraction + 1 / 16) % 1) * 8) % 8];
    const untilFull = ((0.5 - fraction + 1) % 1) * SYNODIC_MONTH;

    return {
        name: phase.name,
        emoji: phase.emoji,
        illumination: (1 - Math.cos(2 * Math.PI * fraction)) / 2,
        waxing: fraction < 0.5,
        nextFullMoon: new Date(date.getTime() + untilFull * DAY_MS),
        daysUntilFull: Math.round(untilFull)
    };
}

/**
 * The lit region of a moon disc at (center, center) with the given radius:
 * a fixed semicircle plus an elliptical arc whose rx follows cos(π·illum).
 * 0 is all dark, 0.5 a straight terminator, 1 the full disc. It lights the
 * right limb; a waning moon mirrors it.
 */
export function litPath(illumination: number, center: number, radius: number): string {
    const rx = Math.abs(Math.cos(Math.PI * illumination)) * radius;
    const sweep = illumination > 0.5 ? 1 : 0;
    return `M ${center} ${center - radius} A ${radius} ${radius} 0 0 1 ${center} ${center + radius} A ${rx.toFixed(2)} ${radius} 0 0 ${sweep} ${center} ${center - radius}`;
}

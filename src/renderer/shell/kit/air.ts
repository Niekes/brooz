/**
 * The air quality category: the step of OpenWeatherMap's air quality index
 * (1 to 5) a place is on. Every tile that speaks of air quality reads this
 * one scale.
 */

export interface AirCategory {
    label: string;
    color: string;
}

/** The steps of the index, from 1 (good) to 5 (very poor), as OpenWeatherMap names them. */
const AIR_CATEGORIES: readonly AirCategory[] = [
    { label: 'Good', color: '#4ade80' },
    { label: 'Fair', color: '#bef264' },
    { label: 'Moderate', color: '#facc15' },
    { label: 'Poor', color: '#fb923c' },
    { label: 'Very poor', color: '#f87171' }
];

/** The category colors are the data scale itself: the band is the index spectrum. */
export const AIR_BAND = `linear-gradient(to right, ${AIR_CATEGORIES.map((step) => step.color).join(', ')})`;

/** The category of an index step, 1 to 5. */
export function airCategory(aqi: number): AirCategory {
    return AIR_CATEGORIES[aqi - 1];
}

import type { CondName } from './icons';

const WMO_BANDS: ReadonlyArray<{ from: number; to: number; label: string; icon: CondName }> = [
    { from: 0, to: 0, label: 'Clear sky', icon: 'sun' },
    { from: 1, to: 1, label: 'Mainly clear', icon: 'sun' },
    { from: 2, to: 2, label: 'Partly cloudy', icon: 'cloud' },
    { from: 3, to: 3, label: 'Overcast', icon: 'cloud' },
    { from: 45, to: 45, label: 'Fog', icon: 'cloud' },
    { from: 48, to: 48, label: 'Fog', icon: 'cloud' },
    { from: 51, to: 57, label: 'Drizzle', icon: 'rain' },
    { from: 61, to: 67, label: 'Rain', icon: 'rain' },
    { from: 71, to: 77, label: 'Snow', icon: 'snow' },
    { from: 80, to: 82, label: 'Rain showers', icon: 'rain' },
    { from: 85, to: 86, label: 'Snow showers', icon: 'snow' },
    { from: 95, to: Infinity, label: 'Thunderstorm', icon: 'storm' }
];

/** The scale every temperature is shown in, one choice for the whole app. */
export type TemperatureUnit = 'C' | 'F';

/** A Celsius reading in the unit, rounded only after converting. */
export function inUnit(celsius: number, unit: TemperatureUnit): number {
    return Math.round(unit === 'F' ? (celsius * 9) / 5 + 32 : celsius);
}

/**
 * The length unit of the app: meters with Celsius, feet with Fahrenheit -
 * the temperature choice is the one unit setting there is.
 */
export function lengthUnit(unit: TemperatureUnit): 'm' | 'ft' {
    return unit === 'F' ? 'ft' : 'm';
}

/** A meters reading in the length unit, rounded only after converting. */
export function lengthInUnit(meters: number, unit: TemperatureUnit): number {
    return Math.round(unit === 'F' ? meters * 3.28084 : meters);
}

/** The speed unit of the app: km/h with Celsius, mph with Fahrenheit. */
export function speedUnit(unit: TemperatureUnit): 'km/h' | 'mph' {
    return unit === 'F' ? 'mph' : 'km/h';
}

/** A km/h reading in the speed unit, rounded only after converting. */
export function speedInUnit(kmh: number, unit: TemperatureUnit): number {
    return Math.round(unit === 'F' ? kmh / 1.609344 : kmh);
}

/** A WMO weather code as a label and an icon. */
export function weatherInfo(code: number): { label: string; icon: CondName } {
    const band = WMO_BANDS.find(({ from, to }) => code >= from && code <= to);
    return band ? { label: band.label, icon: band.icon } : { label: 'Cloudy', icon: 'cloud' };
}

const TONES: Record<CondName, string> = {
    sun: 'text-[#fcd34d]',
    rain: 'text-[#7dd3fc]',
    snow: 'text-[#e2e8f0]',
    storm: 'text-[#fda4af]',
    cloud: 'text-[#a5b4fc]'
};

/** The accent of a weather icon, as a literal Tailwind class. */
export function weatherTone(icon: CondName): string {
    return TONES[icon];
}

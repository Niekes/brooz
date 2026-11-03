import { FINNHUB, OPENWEATHERMAP, STORMGLASS } from '../shared/providers';
import type {
    MissingKeyReason,
    ProviderId,
    ProviderInfo,
    ProviderOutcome,
    ProviderProbe
} from '../shared/providers';
import type { StockQuote } from '../shared/quotes';
import type { SurfForecast } from '../shared/surf';
import type {
    AirQualitySnapshot,
    Coordinates,
    PlaceQuery,
    WeatherSnapshot
} from '../shared/weather';
import { fetchQuotes, probeKey as probeFinnhub } from './finnhub';
import { canStoreKeys, providerKey } from './key-store';
import { fetchAirQuality, fetchWeather, probeKey as probeOpenWeatherMap } from './openweathermap';
import { fetchSurf, probeKey as probeStormglass } from './stormglass';

/**
 * The provider side of the contract, and the only code that reads a stored
 * key. A missing key never reaches a service: the channel answers with the
 * missing-key union, so the tile invites to the settings instead of failing.
 */

const PROBES: Record<ProviderId, (key: string) => Promise<ProviderProbe>> = {
    finnhub: probeFinnhub,
    openweathermap: probeOpenWeatherMap,
    stormglass: probeStormglass
};

/** Why a key reads as missing: never set, or this OS cannot store keys. */
export async function missingKeyReason(): Promise<MissingKeyReason> {
    return (await canStoreKeys()) ? 'not-set' : 'encryption-unavailable';
}

/** Runs a call with the provider's key, or answers missing-key without one. */
async function withKey<T>(
    provider: ProviderInfo,
    call: (key: string) => Promise<ProviderOutcome<T>>
): Promise<ProviderOutcome<T>> {
    const key = await providerKey(provider.id);
    if (key === null) {
        return { status: 'missing-key', reason: await missingKeyReason() };
    }
    return call(key);
}

/** Quotes the symbols through the provider, with the provider's key. */
export function stockQuotes(symbols: readonly string[]): Promise<ProviderOutcome<StockQuote[]>> {
    return withKey(FINNHUB, (key) => fetchQuotes(key, symbols));
}

/** The weather of a place, through OpenWeatherMap. */
export function weather(query: PlaceQuery): Promise<ProviderOutcome<WeatherSnapshot>> {
    return withKey(OPENWEATHERMAP, (key) => fetchWeather(key, query));
}

/** The air quality of a place, through OpenWeatherMap. */
export function airQuality(query: PlaceQuery): Promise<ProviderOutcome<AirQualitySnapshot>> {
    return withKey(OPENWEATHERMAP, (key) => fetchAirQuality(key, query));
}

/** The swell and the tides of the surf spot, through Stormglass. */
export function surf(spot: Coordinates): Promise<ProviderOutcome<SurfForecast>> {
    return withKey(STORMGLASS, (key) => fetchSurf(key, spot));
}

/** Checks the provider's stored key against its service, for the settings. */
export async function probeProvider(provider: ProviderId): Promise<ProviderProbe> {
    const key = await providerKey(provider);
    if (key === null) {
        return { status: 'missing-key', reason: await missingKeyReason() };
    }
    return PROBES[provider](key);
}

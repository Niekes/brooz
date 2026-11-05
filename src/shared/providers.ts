/**
 * The providers of the dashboard: the external services a tile's live data
 * can come from. A provider is the unit of a key - several tiles may share
 * one - and the manifest is static, so the main process and the renderer
 * speak about them with the same ids.
 *
 * How keys are stored and kept away from the renderer is decided in
 * `docs/adr/0001-provider-keys-never-reach-the-renderer.md` and
 * `docs/adr/0002-safe-storage-fail-closed.md`.
 */

export type ProviderId = 'finnhub' | 'openweathermap' | 'stormglass' | 'opensky';

export interface ProviderInfo {
    readonly id: ProviderId;
    /** The name a person knows the service by. */
    readonly title: string;
    /** Where the key comes from, in one sentence. */
    readonly description: string;
    /** The domain the key is created at; `brooz:key-page` opens it in the system browser. */
    readonly keyUrl: string;
}

/** Finnhub quotes stocks and crypto for the markets tile. */
export const FINNHUB: ProviderInfo = {
    id: 'finnhub',
    title: 'Finnhub',
    description: 'Stock and crypto quotes for the markets tile.',
    keyUrl: 'finnhub.io/register'
};

/** OpenWeatherMap: the weather and air-quality tiles. */
export const OPENWEATHERMAP: ProviderInfo = {
    id: 'openweathermap',
    title: 'OpenWeatherMap',
    description: 'Current weather, forecasts and air quality.',
    keyUrl: 'home.openweathermap.org/api_keys'
};

/** Stormglass: the surf tile's swell and tides, ten requests a day on the free plan. */
export const STORMGLASS: ProviderInfo = {
    id: 'stormglass',
    title: 'Stormglass',
    description: 'Swell, wind and tides for the surf tile. The free plan allows 10 requests a day.',
    keyUrl: 'stormglass.io'
};

/**
 * OpenSky Network: the live positions of flights for the flight tracker tile.
 * The service signs in with an OAuth2 client, so the key is the API client
 * written as `clientId:clientSecret` - still one string in the key store,
 * split and exchanged for a bearer token by the main process alone
 * (docs/adr/0017).
 */
export const OPEN_SKY: ProviderInfo = {
    id: 'opensky',
    title: 'OpenSky Network',
    description:
        'Live positions of flights for the flight tracker. The key is an OpenSky API client, written as clientId:clientSecret.',
    keyUrl: 'opensky-network.org'
};

/** Every provider of the manifest. */
export const PROVIDERS: readonly ProviderInfo[] = [OPENWEATHERMAP, FINNHUB, STORMGLASS, OPEN_SKY];

/** Whether `value` names a provider of the manifest. */
export function providerExists(value: string): value is ProviderId {
    return PROVIDERS.some((provider) => provider.id === value);
}

/** The manifest entry of a provider id; the Record keeps the lookup total. */
const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
    finnhub: FINNHUB,
    openweathermap: OPENWEATHERMAP,
    stormglass: STORMGLASS,
    opensky: OPEN_SKY
};

/** The manifest entry a provider id names. */
export function providerInfo(id: ProviderId): ProviderInfo {
    return PROVIDER_INFO[id];
}

/**
 * Why a provider's key is missing: it was never set, or the OS offers no
 * encrypted storage and the app refuses to keep a key in the clear.
 */
export type MissingKeyReason = 'not-set' | 'encryption-unavailable';

/** The result of saving a key: the app fails closed without OS encryption. */
export type KeySave = { status: 'ok' } | { status: 'encryption-unavailable' };

/** What the settings learn about a provider's key. Never the key itself. */
export interface KeyStatus {
    present: boolean;
    /** Whether this system can store keys at all. */
    canStore: boolean;
}

/** The result of checking a stored key against its service. */
export type ProviderProbe =
    | { status: 'ok' }
    | { status: 'missing-key'; reason: MissingKeyReason }
    | { status: 'provider-error'; message: string };

/**
 * What every provider channel answers with: the data, an invitation to the
 * settings because the key is missing, or the provider's own error. A
 * provider channel never throws, so a tile cannot forget a state.
 */
export type ProviderOutcome<T> =
    | { status: 'ok'; data: T }
    | { status: 'missing-key'; reason: MissingKeyReason }
    | { status: 'provider-error'; message: string };

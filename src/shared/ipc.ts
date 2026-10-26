/**
 * The typed IPC contract between the main process and the renderer.
 *
 * This is the only file both sides import. A channel is added here first,
 * then handled in `src/main/ipc.ts`; the preload bridge is generic and needs
 * no change.
 */

import type { AirQualitySnapshot, GeoPlace, PlaceQuery, WeatherSnapshot } from './weather';
import type { ProviderId, KeySave, KeyStatus, ProviderProbe, ProviderOutcome } from './providers';
import type { StockQuote } from './quotes';

export const IPC_CHANNELS = {
    appVersion: 'brooz:app-version',
    geocode: 'brooz:geocode',
    weather: 'brooz:weather',
    airQuality: 'brooz:air-quality',
    keySet: 'brooz:key-set',
    keyDelete: 'brooz:key-delete',
    keyStatus: 'brooz:key-status',
    keyTest: 'brooz:key-test',
    stockQuotes: 'brooz:stock-quotes'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** The arguments and the result of every channel. */
export interface IpcContract {
    [IPC_CHANNELS.appVersion]: {
        args: [];
        result: string;
    };
    [IPC_CHANNELS.geocode]: {
        args: [city: string];
        result: GeoPlace;
    };
    [IPC_CHANNELS.weather]: {
        args: [query: PlaceQuery];
        result: WeatherSnapshot;
    };
    [IPC_CHANNELS.airQuality]: {
        args: [query: PlaceQuery];
        result: AirQualitySnapshot;
    };
    [IPC_CHANNELS.keySet]: {
        args: [provider: ProviderId, key: string];
        result: KeySave;
    };
    [IPC_CHANNELS.keyDelete]: {
        args: [provider: ProviderId];
        result: void;
    };
    [IPC_CHANNELS.keyStatus]: {
        args: [provider: ProviderId];
        result: KeyStatus;
    };
    [IPC_CHANNELS.keyTest]: {
        args: [provider: ProviderId];
        result: ProviderProbe;
    };
    [IPC_CHANNELS.stockQuotes]: {
        args: [symbols: string[]];
        result: ProviderOutcome<StockQuote[]>;
    };
}

export type IpcArgs<Channel extends IpcChannel> = IpcContract[Channel]['args'];
export type IpcResult<Channel extends IpcChannel> = IpcContract[Channel]['result'];

/** The API the preload exposes on `window.brooz`. */
export interface BroozApi {
    invoke<Channel extends IpcChannel>(
        channel: Channel,
        ...args: IpcArgs<Channel>
    ): Promise<IpcResult<Channel>>;
}

declare global {
    interface Window {
        brooz: BroozApi;
    }
}

const channelNames: readonly string[] = Object.values(IPC_CHANNELS);

/** Whether `channel` is part of the contract. The preload rejects the rest. */
export function isIpcChannel(channel: string): channel is IpcChannel {
    return channelNames.includes(channel);
}

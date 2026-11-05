import { app, ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { IpcChannel } from '../shared/ipc';
import { providerInfo } from '../shared/providers';
import { geocodeCity } from './open-meteo';
import { isAppOrigin } from './origin';
import { STYLE_NONCE } from './protocol';
import {
    parseCity,
    parseCoordinates,
    parseFlights,
    parseKeyInput,
    parsePlaceQuery,
    parseProviderId,
    parseSymbols
} from './validate';
import { canStoreKeys, deleteKey, providerKey, saveKey } from './key-store';
import { airQuality, flightStates, probeProvider, stockQuotes, surf, weather } from './providers';

/**
 * Registers one handler behind the sender check: it only answers frames from
 * the app itself, the app:// origin or the dev server.
 */
function handle(
    channel: IpcChannel,
    devUrl: string | undefined,
    respond: (...args: unknown[]) => unknown
): void {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
        const senderUrl = event.senderFrame?.url ?? '';
        if (!isAppOrigin(senderUrl, devUrl)) {
            throw new Error(`Rejected IPC call from ${senderUrl}`);
        }
        return respond(...args);
    });
}

/** Registers every IPC handler of the contract. */
export function registerIpcHandlers(devUrl?: string): void {
    handle(IPC_CHANNELS.appVersion, devUrl, () => app.getVersion());
    handle(IPC_CHANNELS.geocode, devUrl, (city) => geocodeCity(parseCity(city)));
    handle(IPC_CHANNELS.weather, devUrl, (query) => weather(parsePlaceQuery(query)));
    handle(IPC_CHANNELS.airQuality, devUrl, (query) => airQuality(parsePlaceQuery(query)));
    // The key channels: the renderer writes and asks, it never reads a key.
    handle(IPC_CHANNELS.keySet, devUrl, (provider, key) =>
        saveKey(parseProviderId(provider), parseKeyInput(key))
    );
    handle(IPC_CHANNELS.keyDelete, devUrl, (provider) => {
        deleteKey(parseProviderId(provider));
    });
    handle(IPC_CHANNELS.keyStatus, devUrl, async (provider) => ({
        present: (await providerKey(parseProviderId(provider))) !== null,
        canStore: await canStoreKeys()
    }));
    handle(IPC_CHANNELS.keyTest, devUrl, (provider) => probeProvider(parseProviderId(provider)));
    // The key page: the renderer names a provider, never a URL; the manifest
    // decides what opens in the system browser (docs/adr/0016).
    handle(IPC_CHANNELS.keyPage, devUrl, (provider) => {
        // The channel answers nothing, so a browser that fails to open is swallowed.
        void shell
            .openExternal(`https://${providerInfo(parseProviderId(provider)).keyUrl}`)
            .catch(() => undefined);
    });
    handle(IPC_CHANNELS.stockQuotes, devUrl, (symbols) => stockQuotes(parseSymbols(symbols)));
    handle(IPC_CHANNELS.surf, devUrl, (spot) => surf(parseCoordinates(spot)));
    handle(IPC_CHANNELS.flightStates, devUrl, (flights) => flightStates(parseFlights(flights)));
    handle(IPC_CHANNELS.styleNonce, devUrl, () => STYLE_NONCE);
}

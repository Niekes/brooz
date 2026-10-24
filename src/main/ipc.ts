import { app, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { IpcChannel } from '../shared/ipc';
import { fetchAirQuality, fetchWeather, geocodeCity } from './open-meteo';
import { isAppOrigin } from './origin';
import { parseCity, parsePlaceQuery } from './validate';

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
    handle(IPC_CHANNELS.weather, devUrl, (query) => fetchWeather(parsePlaceQuery(query)));
    handle(IPC_CHANNELS.airQuality, devUrl, (query) => fetchAirQuality(parsePlaceQuery(query)));
}

import { app, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { IpcChannel } from '../shared/ipc';
import type { PlaceQuery } from '../shared/weather';
import { fetchAirQuality, fetchWeather, geocodeCity } from './open-meteo';
import { isAppOrigin } from './origin';

const MAX_CITY_LENGTH = 100;

/**
 * The renderer is untrusted input: a city is a short, non-empty string, and
 * coordinates are finite and on the globe. Anything else never reaches the
 * network.
 */
function parseCity(value: unknown): string {
    if (typeof value !== 'string') {
        throw new TypeError('A city must be a string.');
    }
    const city = value.trim();
    if (city.length === 0 || city.length > MAX_CITY_LENGTH) {
        throw new RangeError(`A city has 1 to ${MAX_CITY_LENGTH} characters.`);
    }
    return city;
}

function inRange(value: unknown, limit: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

function parsePlaceQuery(value: unknown): PlaceQuery {
    if (typeof value !== 'object' || value === null) {
        throw new TypeError('A place is a city or coordinates.');
    }
    if ('city' in value) {
        return { city: parseCity(value.city) };
    }
    const { latitude, longitude } = value as Record<string, unknown>;
    if (!inRange(latitude, 90) || !inRange(longitude, 180)) {
        throw new RangeError('Coordinates are out of range.');
    }
    return { latitude, longitude };
}

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

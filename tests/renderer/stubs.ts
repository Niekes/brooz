import { vi } from 'vite-plus/test';
import type { AirQualitySnapshot, GeoPlace, WeatherSnapshot } from '../../src/shared/weather';

/** `window.brooz` answering each channel with the given handler; returns its invoke. */
export function stubBrooz(
    handlers: Record<string, (...args: unknown[]) => unknown>
): ReturnType<typeof vi.fn> {
    const invoke = vi.fn((channel: string, ...args: unknown[]) =>
        Promise.resolve().then(() => handlers[channel](...args))
    );
    window.brooz = { invoke: invoke as unknown as typeof window.brooz.invoke };
    return invoke;
}

export const PLACE: GeoPlace = {
    name: 'Rome',
    latitude: 41.9,
    longitude: 12.5,
    timezone: 'Europe/Rome'
};

export const WEATHER: WeatherSnapshot = {
    place: PLACE,
    temperatureC: 21.4,
    apparentC: 20.6,
    humidity: 55,
    windKmh: 12.2,
    code: 61,
    isDay: true,
    observedAt: '18:00',
    timezoneAbbreviation: 'CEST',
    daily: [
        { date: '2026-10-24', code: 0, minC: 12, maxC: 22, precipitationProbability: 10 },
        { date: '2026-10-25', code: 61, minC: 11, maxC: 19, precipitationProbability: 80 },
        { date: '2026-10-26', code: 3, minC: 10, maxC: 18, precipitationProbability: 20 },
        { date: '2026-10-27', code: 71, minC: 1, maxC: 4, precipitationProbability: 30 },
        { date: '2026-10-28', code: 95, minC: 9, maxC: 17, precipitationProbability: 40 }
    ]
};

export const AIR: AirQualitySnapshot = {
    place: PLACE,
    aqi: 35,
    pm25: 8.3,
    pm10: 12,
    observedAt: '18:00'
};

/** A Worker stand-in: it records what the page posts and lets a test answer. */
export interface FakeWorker {
    readonly url: URL;
    readonly options: WorkerOptions;
    readonly posted: unknown[];
    terminated: boolean;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: (() => void) | null;
    emit(data: unknown): void;
    /** The worker script failed to load or crashed. */
    fail(): void;
}

/** Replaces the global Worker; the returned list fills as workers are created. */
export function stubWorker(): FakeWorker[] {
    const workers: FakeWorker[] = [];
    vi.stubGlobal(
        'Worker',
        vi.fn(function (url: URL, options: WorkerOptions) {
            const worker = {
                url,
                options,
                posted: [] as unknown[],
                terminated: false,
                onmessage: null as FakeWorker['onmessage'],
                onerror: null as FakeWorker['onerror'],
                postMessage: (message: unknown) => worker.posted.push(message),
                terminate: () => {
                    worker.terminated = true;
                },
                emit: (data: unknown) => worker.onmessage!({ data }),
                fail: () => worker.onerror!()
            };
            workers.push(worker);
            return worker;
        })
    );
    return workers;
}

/** `matchMedia` for the reduced-motion query, switchable from a test. */
export function stubMatchMedia(matches: boolean): { set: (value: boolean) => void } {
    const listeners = new Set<() => void>();
    const query = {
        matches,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
    };
    window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia;
    return {
        set(value) {
            query.matches = value;
            for (const listener of listeners) {
                listener();
            }
        }
    };
}

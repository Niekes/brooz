import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AppCard } from '../../src/renderer/shell/glass/app-card';
import { Backdrop } from '../../src/renderer/shell/glass/backdrop';
import { TileHeader } from '../../src/renderer/shell/kit/chrome';
import { LiveData, LiveError, LiveFrame, ProviderData } from '../../src/renderer/shell/kit/live';
import { FINNHUB } from '../../src/shared/providers';
import type { ProviderOutcome } from '../../src/shared/providers';
import { ConditionIcon } from '../../src/renderer/shell/kit/icons';
import { HUES, clock, pick, rng } from '../../src/renderer/shell/kit/seed';
import { weatherInfo, weatherTone } from '../../src/renderer/shell/kit/weather';
import { AIR, PLACE, WEATHER, stubBrooz } from './stubs';

describe('the seeded data', () => {
    it('picks deterministically, negative seeds too', () => {
        expect(pick(3, ['a', 'b'])).toBe('b');
        expect(pick(-3, ['a', 'b'])).toBe('b');
        expect(HUES).toHaveLength(8);
    });

    it('draws the same series for the same seed', () => {
        const a = rng(42);
        const b = rng(42);
        const first = [a(), a(), a()];
        expect([b(), b(), b()]).toEqual(first);
        expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
        expect(rng(0)()).toBe(rng(1)());
    });

    it('formats a clock', () => {
        expect(clock(9, 5)).toBe('09:05');
    });
});

describe('the tile chrome', () => {
    it('shows a header with its tag', () => {
        render(<TileHeader title="Clock" tag="MOCK" />);
        expect(screen.getByText('Clock')).toBeTruthy();
        expect(screen.getByText('MOCK')).toBeTruthy();
    });

    it('marks a live tile with low confidence and its place', () => {
        render(
            <LiveFrame label="Weather" meta="Rome" lowConfidence>
                body
            </LiveFrame>
        );
        expect(screen.getByText('Low confidence')).toBeTruthy();
        expect(screen.getByText('Rome')).toBeTruthy();
    });

    it('leaves both out when there is nothing to say', () => {
        render(<LiveFrame label="Weather">body</LiveFrame>);
        expect(screen.queryByText('Low confidence')).toBe(null);
    });

    it('shows an error with a retry, or a default message', () => {
        const retry = vi.fn();
        const { rerender } = render(<LiveError message="Offline" onRetry={retry} />);
        fireEvent.click(screen.getByText('Retry'));
        expect(retry).toHaveBeenCalled();
        rerender(<LiveError message={null} onRetry={retry} />);
        expect(screen.getByText("I couldn't load that right now.")).toBeTruthy();
    });

    it('walks a live tile through loading, error and data', () => {
        const state = { data: null, error: null, loading: true, reload: vi.fn() };
        const view = (overrides: object, pending = false) => (
            <LiveData
                label="Weather"
                lowConfidence={false}
                pending={pending}
                state={{ ...state, ...overrides }}
                meta={(data: string) => `meta ${data}`}
            >
                {(data: string) => <p>data {data}</p>}
            </LiveData>
        );
        const { rerender } = render(view({}, true));
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        rerender(view({}));
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        rerender(view({ loading: false, error: 'Nope' }));
        expect(screen.getByText('Nope')).toBeTruthy();
        rerender(view({ loading: false }));
        expect(screen.getByText("I couldn't load that right now.")).toBeTruthy();
        rerender(view({ loading: true, data: 'x' }));
        expect(screen.getByText('data x')).toBeTruthy();
        expect(screen.getByText('meta x')).toBeTruthy();
    });

    it('draws every weather condition', () => {
        for (const name of ['sun', 'cloud', 'rain', 'snow', 'storm'] as const) {
            const { container } = render(<ConditionIcon name={name} />);
            expect(container.querySelector(`[data-icon="${name}"]`)).toBeTruthy();
        }
    });

    it('paints the backdrop and a glass card', () => {
        const { container } = render(
            <>
                <Backdrop />
                <AppCard>plain</AppCard>
                <AppCard className="relative">placed</AppCard>
            </>
        );
        expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(4);
        expect(screen.getByText('placed').parentElement!.className).toContain('relative');
    });
});

describe('the weather codes', () => {
    it.each([
        [0, 'Clear sky', 'sun'],
        [1, 'Mainly clear', 'sun'],
        [2, 'Partly cloudy', 'cloud'],
        [3, 'Overcast', 'cloud'],
        [45, 'Fog', 'cloud'],
        [48, 'Fog', 'cloud'],
        [53, 'Drizzle', 'rain'],
        [63, 'Rain', 'rain'],
        [75, 'Snow', 'snow'],
        [81, 'Rain showers', 'rain'],
        [86, 'Snow showers', 'snow'],
        [99, 'Thunderstorm', 'storm'],
        [46, 'Cloudy', 'cloud']
    ])('reads %i as %s', (code, label, icon) => {
        expect(weatherInfo(code)).toEqual({ label, icon });
    });

    it('tones every icon', () => {
        expect(weatherTone('sun')).toBe('text-[#fcd34d]');
        expect(weatherTone('cloud')).toBe('text-[#a5b4fc]');
    });
});

describe('the live data hooks', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    async function hooks() {
        return import('../../src/renderer/shell/kit/hooks');
    }

    it('uses the city of the utterance right away', async () => {
        const { useLiveLocation } = await hooks();
        const { result } = renderHook(() => useLiveLocation('Rome'));
        expect(result.current).toEqual({ query: { city: 'Rome' }, pending: false });
    });

    it('falls back to Berlin without a device location', async () => {
        const { useLiveLocation } = await hooks();
        const { result } = renderHook(() => useLiveLocation());
        expect(result.current.pending).toBe(true);
        await waitFor(() =>
            expect(result.current).toEqual({ query: { city: 'Berlin' }, pending: false })
        );
    });

    it('uses the device location when it is granted, and asks only once', async () => {
        const getCurrentPosition = vi.fn((success: PositionCallback) =>
            success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
        );
        vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
        const { useLiveLocation } = await hooks();
        const first = renderHook(() => useLiveLocation());
        await waitFor(() =>
            expect(first.result.current.query).toEqual({ latitude: 1, longitude: 2 })
        );
        const second = renderHook(() => useLiveLocation());
        await waitFor(() => expect(second.result.current.pending).toBe(false));
        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('falls back to Berlin when the location is denied, and ignores a late answer', async () => {
        let deny!: () => void;
        vi.stubGlobal('navigator', {
            geolocation: {
                getCurrentPosition: (_success: PositionCallback, error: () => void) => {
                    deny = error;
                }
            }
        });
        const { useLiveLocation } = await hooks();
        const gone = renderHook(() => useLiveLocation());
        gone.unmount();
        const { result } = renderHook(() => useLiveLocation());
        act(() => deny());
        await waitFor(() => expect(result.current.query).toEqual({ city: 'Berlin' }));
    });

    it('loads the weather and the air quality over IPC', async () => {
        const invoke = stubBrooz({
            'brooz:weather': () => WEATHER,
            'brooz:air-quality': () => AIR
        });
        const { useAirQuality, useWeather } = await hooks();
        const weather = renderHook(() => useWeather({ city: 'Rome' }));
        expect(weather.result.current.loading).toBe(true);
        await waitFor(() => expect(weather.result.current.data).toBe(WEATHER));
        const air = renderHook(() => useAirQuality({ latitude: 1, longitude: 2 }));
        await waitFor(() => expect(air.result.current.data).toBe(AIR));
        expect(invoke).toHaveBeenCalledWith('brooz:air-quality', {
            latitude: 1,
            longitude: 2
        });
    });

    it('waits without a place and without a city', async () => {
        const invoke = stubBrooz({});
        const { usePlace, useWeather } = await hooks();
        const weather = renderHook(() => useWeather(null));
        const place = renderHook(() => usePlace(undefined));
        expect(weather.result.current).toMatchObject({ data: null, loading: false });
        expect(place.result.current).toMatchObject({ data: null, loading: false });
        expect(invoke).not.toHaveBeenCalled();
    });

    it('unwraps an IPC error and loads again on reload', async () => {
        let fail = true;
        stubBrooz({
            'brooz:geocode': () => {
                if (fail) {
                    throw new Error(
                        "Error invoking remote method 'brooz:geocode': Error: I couldn't find “X”."
                    );
                }
                return PLACE;
            }
        });
        const { usePlace } = await hooks();
        const { result } = renderHook(() => usePlace('X'));
        await waitFor(() => expect(result.current.error).toBe("I couldn't find “X”."));
        fail = false;
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.data).toBe(PLACE));
    });

    it('says something went wrong when the failure is not an Error', async () => {
        stubBrooz({ 'brooz:geocode': () => Promise.reject(new Error('plain')) });
        window.brooz.invoke = vi.fn(() => Promise.reject('nope')) as never;
        const { usePlace } = await hooks();
        const { result } = renderHook(() => usePlace('Y'));
        await waitFor(() =>
            expect(result.current.error).toBe('Something went wrong while loading.')
        );
    });

    it('drops an answer that arrives after the request changed', async () => {
        const answers: Array<(value: unknown) => void> = [];
        const failures: Array<(cause: unknown) => void> = [];
        window.brooz = {
            invoke: vi.fn(
                () =>
                    new Promise((resolve, reject) => {
                        answers.push(resolve);
                        failures.push(reject);
                    })
            ) as never
        };
        const { usePlace } = await hooks();
        const { result, rerender } = renderHook(({ city }) => usePlace(city), {
            initialProps: { city: 'A' }
        });
        rerender({ city: 'B' });
        rerender({ city: 'C' });
        await act(async () => {
            answers[0]({ ...PLACE, name: 'A' });
            failures[1](new Error('late'));
            answers[2]({ ...PLACE, name: 'C' });
            await Promise.resolve();
        });
        await waitFor(() => expect(result.current.data?.name).toBe('C'));
        expect(result.current.error).toBe(null);
    });

    it('ticks every second', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-24T10:00:00'));
        const { useNow } = await hooks();
        const { result, unmount } = renderHook(() => useNow());
        expect(result.current.getSeconds()).toBe(0);
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(result.current.getSeconds()).toBe(2);
        unmount();
    });
});

describe('the quotes hook', () => {
    afterEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    async function hooks() {
        return import('../../src/renderer/shell/kit/hooks');
    }

    it('loads quotes over the provider channel', async () => {
        const QUOTES = [
            { symbol: 'AAPL', price: 189.4, changePercent: -1.2 },
            { symbol: 'BTC-USD', price: 67420, changePercent: 0.8 }
        ];
        const invoke = stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'ok', data: QUOTES }) });
        const { useQuotes } = await hooks();
        const { result } = renderHook(() => useQuotes(['AAPL', 'BTC-USD']));
        await waitFor(() => expect(result.current.data).toEqual({ status: 'ok', data: QUOTES }));
        expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes', ['AAPL', 'BTC-USD']);
    });

    it('asks nothing without symbols', async () => {
        const invoke = stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'ok', data: [] }) });
        const { useQuotes } = await hooks();
        const { result } = renderHook(() => useQuotes(null));
        expect(result.current).toMatchObject({ data: null, loading: false });
        expect(invoke).not.toHaveBeenCalled();
    });
});

describe('the provider chrome', () => {
    const view = (state: {
        data?: ProviderOutcome<string> | null;
        error?: string | null;
        loading?: boolean;
        reload?: () => void;
    }) => (
        <ProviderData
            label="Markets"
            lowConfidence={false}
            provider={FINNHUB}
            state={{
                data: null,
                error: null,
                loading: false,
                reload: vi.fn(),
                ...state
            }}
        >
            {(data: string) => <p>quotes {data}</p>}
        </ProviderData>
    );

    it('shows a skeleton while it loads and when it is idle', () => {
        const { rerender } = render(view({ loading: true }));
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        rerender(view({}));
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
    });

    it('renders the data and names the provider', () => {
        render(view({ data: { status: 'ok', data: 'AAPL 189.4' } }));
        expect(screen.getByText('quotes AAPL 189.4')).toBeTruthy();
        expect(screen.getByText('Finnhub')).toBeTruthy();
    });

    it('invites to the settings while the key is missing', () => {
        render(view({ data: { status: 'missing-key', reason: 'not-set' } }));
        expect(screen.getByText('Needs a Finnhub API key.')).toBeTruthy();
    });

    it('explains when the system cannot store keys', () => {
        render(view({ data: { status: 'missing-key', reason: 'encryption-unavailable' } }));
        expect(
            screen.getByText('This system offers no encrypted place for a Finnhub key.')
        ).toBeTruthy();
    });

    it('shows the provider error with a retry', () => {
        const reload = vi.fn();
        render(
            view({
                data: { status: 'provider-error', message: 'Finnhub replied with 401.' },
                reload
            })
        );
        expect(screen.getByText('Finnhub replied with 401.')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(reload).toHaveBeenCalled();
    });

    it('shows the error when the channel itself rejects', () => {
        render(view({ error: 'Unknown IPC channel' }));
        expect(screen.getByText('Unknown IPC channel')).toBeTruthy();
    });
});

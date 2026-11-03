import {
    act,
    cleanup,
    fireEvent,
    render,
    renderHook,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AppCard } from '../../src/renderer/shell/glass/app-card';
import { Backdrop } from '../../src/renderer/shell/glass/backdrop';
import { TileHeader } from '../../src/renderer/shell/kit/chrome';
import { LiveError, LiveFrame, ProviderData } from '../../src/renderer/shell/kit/live';
import { FINNHUB } from '../../src/shared/providers';
import type { ProviderOutcome } from '../../src/shared/providers';
import { airCategory } from '../../src/renderer/shell/kit/air';
import { ConditionIcon } from '../../src/renderer/shell/kit/icons';
import { pick, rng } from '../../src/renderer/shell/kit/seed';
import {
    inUnit,
    lengthInUnit,
    lengthUnit,
    speedInUnit,
    speedUnit,
    weatherInfo,
    weatherTone
} from '../../src/renderer/shell/kit/weather';
import { PLACE, WEATHER, stubBrooz, stubGeolocation } from './stubs';

describe('the seeded data', () => {
    it('names every step of the air quality index, ends included', () => {
        expect([1, 2, 3, 4, 5].map((aqi) => airCategory(aqi).label)).toEqual([
            'Good',
            'Fair',
            'Moderate',
            'Poor',
            'Very poor'
        ]);
    });

    it('picks deterministically, negative seeds too', () => {
        expect(pick(3, ['a', 'b'])).toBe('b');
        expect(pick(-3, ['a', 'b'])).toBe('b');
    });

    it('draws the same series for the same seed', () => {
        const a = rng(42);
        const b = rng(42);
        const first = [a(), a(), a()];
        expect([b(), b(), b()]).toEqual(first);
        expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
        expect(rng(0)()).toBe(rng(1)());
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

    it('converts a Celsius reading before it rounds', () => {
        expect(inUnit(21.4, 'C')).toBe(21);
        expect(inUnit(21.4, 'F')).toBe(71);
        expect(inUnit(-40, 'F')).toBe(-40);
    });

    it('names the length and speed unit of the temperature choice', () => {
        expect(lengthUnit('C')).toBe('m');
        expect(lengthUnit('F')).toBe('ft');
        expect(speedUnit('C')).toBe('km/h');
        expect(speedUnit('F')).toBe('mph');
    });

    it('converts a length and a speed before it rounds', () => {
        expect(lengthInUnit(1.5, 'C')).toBe(2);
        expect(lengthInUnit(1.5, 'F')).toBe(5);
        expect(lengthInUnit(0.3, 'F')).toBe(1);
        expect(speedInUnit(12, 'C')).toBe(12);
        expect(speedInUnit(12, 'F')).toBe(7);
        expect(speedInUnit(1.609344, 'F')).toBe(1);
    });
});

describe('the live data hooks', () => {
    afterEach(() => {
        // The location watch is cleared on unmount, so unmount before unstubbing.
        cleanup();
        vi.useRealTimers();
        vi.resetModules();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    async function hooks() {
        return import('../../src/renderer/shell/kit/hooks');
    }

    async function stored() {
        return import('../../src/renderer/shell/kit/stored');
    }

    it('follows the device location, a kilometre at a time', async () => {
        const { clearWatch } = stubGeolocation({ latitude: 53.5511, longitude: 9.9937 });
        const { NO_LOCATION, useDeviceLocation } = await hooks();
        const { result, unmount } = renderHook(() => useDeviceLocation(NO_LOCATION));
        await waitFor(() =>
            expect(result.current).toEqual({
                query: { latitude: 53.55, longitude: 9.99 },
                pending: false,
                name: null
            })
        );
        unmount();
        expect(clearWatch).toHaveBeenCalledWith(7);
    });

    it('falls back to the location it is given when the device location is denied', async () => {
        stubGeolocation();
        const { savedLocation, useDeviceLocation } = await hooks();
        const saved = savedLocation(PLACE);
        const { result } = renderHook(() => useDeviceLocation(saved));
        await waitFor(() => expect(result.current).toBe(saved));
    });

    it('never asks for the device location when disabled', async () => {
        const getCurrentPosition = vi.fn();
        vi.stubGlobal('navigator', {
            userAgent: navigator.userAgent,
            geolocation: { getCurrentPosition, watchPosition: getCurrentPosition }
        });
        const { savedLocation, useDeviceLocation } = await hooks();
        const saved = savedLocation(PLACE);
        const { result } = renderHook(() => useDeviceLocation(saved, false));
        expect(result.current).toBe(saved);
        expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it('reads the default location as its coordinates and its name, and none as no query', async () => {
        const { NO_LOCATION, savedLocation } = await hooks();
        expect(savedLocation(PLACE)).toEqual({
            query: { latitude: 41.9, longitude: 12.5 },
            pending: false,
            name: 'Rome'
        });
        expect(savedLocation(null)).toBe(NO_LOCATION);
        expect(NO_LOCATION).toEqual({ query: null, pending: false, name: null });
    });

    it('waits while the device location is unsettled', async () => {
        vi.stubGlobal('navigator', {
            geolocation: {
                getCurrentPosition: () => undefined,
                watchPosition: () => 1,
                clearWatch: () => undefined
            }
        });
        const { NO_LOCATION, useDeviceLocation } = await hooks();
        const { result } = renderHook(() => useDeviceLocation(NO_LOCATION));
        expect(result.current).toEqual({ query: null, pending: true, name: null });
    });

    it('resolves the live location: the city, else the tile, else the device, else the default', async () => {
        stubGeolocation({ latitude: 53.55, longitude: 9.99 });
        const { useLiveLocation } = await hooks();
        const city = renderHook(() => useLiveLocation('Rome', 'weather'));
        expect(city.result.current).toEqual({
            query: { city: 'Rome' },
            pending: false,
            name: null
        });

        // The tile's own location wins over the device location.
        localStorage.setItem(
            'brooz.tile.weather.location',
            JSON.stringify({ ...PLACE, name: 'Lisbon' })
        );
        const tile = renderHook(() => useLiveLocation(undefined, 'weather'));
        await waitFor(() =>
            expect(tile.result.current).toEqual({
                query: { latitude: 41.9, longitude: 12.5 },
                pending: false,
                name: 'Lisbon'
            })
        );

        // Another tile without its own location follows the device location.
        const device = renderHook(() => useLiveLocation(undefined, 'air-quality'));
        await waitFor(() =>
            expect(device.result.current).toEqual({
                query: { latitude: 53.55, longitude: 9.99 },
                pending: false,
                name: null
            })
        );

        localStorage.setItem('brooz.location.default', JSON.stringify(PLACE));
        localStorage.setItem('brooz.location.enabled', 'false');
        const fallback = renderHook(() => useLiveLocation(undefined, 'ticker'));
        await waitFor(() =>
            expect(fallback.result.current).toEqual({
                query: { latitude: 41.9, longitude: 12.5 },
                pending: false,
                name: 'Rome'
            })
        );
    });

    it('keeps the surf spot and the start tile as stored values', async () => {
        const { START_TILE_KEY, useStartTile, useSurfSpot } = await stored();
        expect(START_TILE_KEY).toBe('brooz.start.tile');
        const spot = renderHook(() => useSurfSpot());
        expect(spot.result.current[0]).toBe(null);
        act(() => spot.result.current[1](PLACE));
        expect(localStorage.getItem('brooz.surf.spot')).toBe(JSON.stringify(PLACE));
        const start = renderHook(() => useStartTile());
        expect(start.result.current[0]).toBe('about');
        act(() => start.result.current[1]('surf'));
        expect(localStorage.getItem(START_TILE_KEY)).toBe('"surf"');
    });

    it('loads a provider channel over IPC, and nothing without a key', async () => {
        const invoke = stubBrooz({
            'brooz:stock-quotes': () => ({ status: 'ok', data: [] }),
            'brooz:weather': () => ({ status: 'ok', data: WEATHER })
        });
        const { useProviderData } = await hooks();
        const quotes = renderHook(() => useProviderData('brooz:stock-quotes', 'AAPL', [['AAPL']]));
        expect(quotes.result.current.loading).toBe(true);
        await waitFor(() => expect(quotes.result.current.data?.status).toBe('ok'));
        expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes', ['AAPL']);
        const idle = renderHook(() => useProviderData('brooz:weather', null, [null]));
        expect(idle.result.current).toMatchObject({ data: null, loading: false });
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('unwraps an IPC error and loads again on reload', async () => {
        let fail = true;
        stubBrooz({
            'brooz:weather': () => {
                if (fail) {
                    throw new Error(
                        "Error invoking remote method 'brooz:weather': Error: Offline."
                    );
                }
                return { status: 'ok', data: WEATHER };
            }
        });
        const { useProviderData } = await hooks();
        const { result } = renderHook(() =>
            useProviderData('brooz:weather', 'Rome', [{ city: 'Rome' }])
        );
        await waitFor(() => expect(result.current.error).toBe('Offline.'));
        fail = false;
        act(() => result.current.reload());
        await waitFor(() => expect(result.current.data?.status).toBe('ok'));
    });

    it('says something went wrong when the failure is not an Error', async () => {
        window.brooz = { invoke: vi.fn(() => Promise.reject('nope')) as never };
        const { useProviderData } = await hooks();
        const { result } = renderHook(() => useProviderData('brooz:weather', 'Rome', [{}]));
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
        const { useProviderData } = await hooks();
        const { result, rerender } = renderHook(
            ({ city }) => useProviderData('brooz:weather', city, [{ city }]),
            {
                initialProps: { city: 'A' }
            }
        );
        rerender({ city: 'B' });
        rerender({ city: 'C' });
        await act(async () => {
            answers[0]({ status: 'ok', data: { name: 'A' } });
            failures[1](new Error('late'));
            answers[2]({ status: 'ok', data: { name: 'C' } });
            await Promise.resolve();
        });
        await waitFor(() => expect(result.current.data).toMatchObject({ data: { name: 'C' } }));
        expect(result.current.error).toBe(null);
    });

    it('loads a place-based tile: the city, or a notice when there is no location', async () => {
        stubGeolocation();
        const invoke = stubBrooz({ 'brooz:weather': () => ({ status: 'ok', data: WEATHER }) });
        const { usePlaceData } = await hooks();
        const withCity = renderHook(() => usePlaceData('Rome', 'brooz:weather', 'weather'));
        expect(withCity.result.current.notice).toBe(null);
        await waitFor(() => expect(withCity.result.current.state.data?.status).toBe('ok'));
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { city: 'Rome' });

        localStorage.removeItem('brooz.location.default');
        localStorage.setItem('brooz.location.enabled', 'false');
        const without = renderHook(() => usePlaceData(undefined, 'brooz:weather', 'weather'));
        expect(without.result.current.notice).toBe('Set a location first.');
        expect(without.result.current.state.data).toBe(null);
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('marks a place-based tile pending while the device location is unsettled', async () => {
        vi.stubGlobal('navigator', {
            geolocation: {
                getCurrentPosition: () => undefined,
                watchPosition: () => 1,
                clearWatch: () => undefined
            }
        });
        stubBrooz({});
        const { usePlaceData } = await hooks();
        const { result } = renderHook(() => usePlaceData(undefined, 'brooz:weather', 'weather'));
        expect(result.current.pending).toBe(true);
        expect(result.current.notice).toBe(null);
    });

    it('picks the stored provider of a tile, or its first candidate', async () => {
        const { chosenProviderKey, useChosenProvider } = await stored();
        const { OPENWEATHERMAP, FINNHUB } = await import('../../src/shared/providers');
        const tile = {
            id: 'demo',
            title: 'Demo',
            Component: () => null,
            providers: [
                { provider: OPENWEATHERMAP, channel: 'brooz:weather' },
                { provider: FINNHUB, channel: 'brooz:stock-quotes' }
            ]
        } as const;
        expect(chosenProviderKey('demo')).toBe('brooz.tile.demo.provider');
        const first = renderHook(() => useChosenProvider(tile));
        expect(first.result.current?.provider.id).toBe('openweathermap');
        localStorage.setItem(chosenProviderKey('demo'), JSON.stringify('finnhub'));
        const chosen = renderHook(() => useChosenProvider(tile));
        expect(chosen.result.current?.provider.id).toBe('finnhub');
        expect(chosen.result.current?.channel).toBe('brooz:stock-quotes');
        localStorage.setItem(chosenProviderKey('demo'), JSON.stringify('not-a-provider'));
        const stale = renderHook(() => useChosenProvider(tile));
        expect(stale.result.current?.provider.id).toBe('openweathermap');
        const keyless = renderHook(() =>
            useChosenProvider({ id: 'x', title: 'X', Component: () => null })
        );
        expect(keyless.result.current).toBeUndefined();
    });
});

describe('the provider chrome', () => {
    const view = (
        state: {
            data?: ProviderOutcome<string> | null;
            error?: string | null;
            loading?: boolean;
            reload?: () => void;
        },
        extra: { pending?: boolean; meta?: (data: string) => string } = {}
    ) => (
        <ProviderData
            label="Markets"
            lowConfidence={false}
            provider={FINNHUB}
            {...extra}
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
        expect(screen.getByText('Needs an API key from Finnhub.')).toBeTruthy();
        expect(screen.getByText('Press Ctrl+, for the settings')).toBeTruthy();
    });

    it('loads again from the invitation once a key was added', () => {
        const reload = vi.fn();
        render(view({ data: { status: 'missing-key', reason: 'not-set' }, reload }));
        fireEvent.click(screen.getByText('Retry'));
        expect(reload).toHaveBeenCalled();
    });

    it('names the macOS shortcut on a Mac', () => {
        const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
        render(view({ data: { status: 'missing-key', reason: 'not-set' } }));
        expect(screen.getByText('Press ⌘, for the settings')).toBeTruthy();
        agent.mockRestore();
    });

    it('waits for a pending location, even over an error', () => {
        render(view({ error: 'Offline' }, { pending: true }));
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
    });

    it('names its data with the given meta instead of the provider', () => {
        render(view({ data: { status: 'ok', data: 'x' } }, { meta: (data) => `meta ${data}` }));
        expect(screen.getByText('meta x')).toBeTruthy();
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

import {
    act,
    cleanup,
    fireEvent,
    render,
    renderHook,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { LiveSlot } from '../../src/renderer/shell/grid/live-slot';
import { useProviderData } from '../../src/renderer/shell/kit/hooks';
import { useDefaultLocation } from '../../src/renderer/shell/kit/stored';
import type { SummonRequest, TileDefinition } from '../../src/renderer/shell/tile';
import { airQualityTile } from '../../src/renderer/tiles/airQuality';
import { surfTile } from '../../src/renderer/tiles/surf';
import { tickerTile } from '../../src/renderer/tiles/ticker';
import { weatherTile } from '../../src/renderer/tiles/weather';
import { FINNHUB } from '../../src/shared/providers';
import { PLACE, WEATHER, stubBrooz, stubGeolocation } from './stubs';

function request(
    widget: string,
    args: SummonRequest['args'] = {},
    lowConfidence = false
): SummonRequest {
    return { widget, args, source: 'rules', confidence: 0.9, lowConfidence };
}

describe('the live slot: the shell chrome around a summoned tile', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('renders a live tile without a remount key under its id', async () => {
        const keyless: TileDefinition = {
            id: 'plain',
            title: 'Plain',
            Component: () => null,
            Live: ({ data }) => <p>got {String(data)}</p>,
            providers: [{ provider: FINNHUB, channel: 'brooz:stock-quotes' }],
            liveData: () => ({
                pending: false,
                notice: null,
                state: {
                    data: { status: 'ok', data: 'x' },
                    error: null,
                    loading: false,
                    reload: vi.fn()
                }
            })
        };
        render(<LiveSlot tile={keyless} request={request('plain')} />);
        expect(await screen.findByText('got x')).toBeTruthy();
        expect(screen.getByText('Plain')).toBeTruthy();
    });

    it("loads over the stored chosen provider's channel, not the first candidate's", async () => {
        const { OPENWEATHERMAP } = await import('../../src/shared/providers');
        const multi: TileDefinition = {
            id: 'multi',
            title: 'Multi',
            Component: () => null,
            Live: ({ data }) => <p>got {String(data)}</p>,
            providers: [
                { provider: OPENWEATHERMAP, channel: 'brooz:weather' },
                { provider: FINNHUB, channel: 'brooz:stock-quotes' }
            ],
            liveData: (_args, channel) => ({
                pending: false,
                notice: null,
                state: useProviderData(channel, 'k', [])
            })
        };
        const invoke = stubBrooz({
            'brooz:weather': () => ({ status: 'ok', data: 'weather-data' }),
            'brooz:stock-quotes': () => ({ status: 'ok', data: 'quotes-data' })
        });
        const first = render(<LiveSlot tile={multi} request={request('multi')} />);
        expect(await screen.findByText('got weather-data')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:weather');
        first.unmount();

        localStorage.setItem('brooz.tile.multi.provider', '"finnhub"');
        render(<LiveSlot tile={multi} request={request('multi')} />);
        expect(await screen.findByText('got quotes-data')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes');
    });

    it('renders nothing for a live tile without a provider', () => {
        const broken: TileDefinition = {
            id: 'broken',
            title: 'Broken',
            Component: () => null,
            Live: () => <p>content</p>
        };
        const { container } = render(<LiveSlot tile={broken} request={request('broken')} />);
        expect(container.firstChild).toBe(null);
    });

    it('loads the weather over the chosen provider channel and shows the data with the status row', async () => {
        const invoke = stubBrooz({
            'brooz:weather': () => ({ status: 'ok', data: WEATHER }),
            'brooz:air-quality': () => new Promise(() => undefined)
        });
        render(<LiveSlot tile={weatherTile} request={request('weather', { city: 'Rome' })} />);
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        expect(screen.getByText('Weather')).toBeTruthy();
        expect(await screen.findByText('21°')).toBeTruthy();
        expect(screen.getByText('OpenWeatherMap')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { city: 'Rome' });
    });

    it('marks a low-confidence summon in the status row, outside the tile content', async () => {
        stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'ok', data: [] }) });
        render(<LiveSlot tile={tickerTile} request={request('ticker', {}, true)} />);
        expect(await screen.findByText('Low confidence')).toBeTruthy();
        expect(screen.getByText('Markets')).toBeTruthy();
        expect(screen.getByText('Finnhub')).toBeTruthy();
    });

    it('invites to the settings while the chosen provider has no key', async () => {
        const invoke = stubBrooz({
            'brooz:stock-quotes': () => ({ status: 'missing-key', reason: 'not-set' })
        });
        render(<LiveSlot tile={tickerTile} request={request('ticker', { symbols: ['AAPL'] })} />);
        expect(await screen.findByText('Needs an API key from Finnhub.')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes', ['AAPL']);
    });

    it('shows the provider error with a retry', async () => {
        stubBrooz({
            'brooz:stock-quotes': () => ({
                status: 'provider-error',
                message: 'Finnhub replied with 401.'
            })
        });
        render(<LiveSlot tile={tickerTile} request={request('ticker', {})} />);
        expect(await screen.findByText('Finnhub replied with 401.')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('shows the error when the channel itself rejects', async () => {
        stubBrooz({
            'brooz:air-quality': () => Promise.reject(new Error('Offline'))
        });
        render(
            <LiveSlot tile={airQualityTile} request={request('air-quality', { city: 'Rome' })} />
        );
        expect(await screen.findByText('Offline')).toBeTruthy();
    });

    it('asks for a location without a device location and without a default one', async () => {
        stubGeolocation();
        localStorage.setItem('brooz.location.enabled', 'false');
        const invoke = stubBrooz({});
        render(<LiveSlot tile={weatherTile} request={request('weather', {})} />);
        expect(await screen.findByText('Set a location first.')).toBeTruthy();
        expect(invoke).not.toHaveBeenCalled();
    });

    it('shows the device location when there is one', async () => {
        stubGeolocation({ latitude: 53.55, longitude: 9.99 });
        const invoke = stubBrooz({
            'brooz:weather': () => ({ status: 'ok', data: WEATHER }),
            'brooz:air-quality': () => new Promise(() => undefined)
        });
        render(<LiveSlot tile={weatherTile} request={request('weather', {})} />);
        expect((await screen.findAllByText(WEATHER.place.name)).length).toBeGreaterThan(0);
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { latitude: 53.55, longitude: 9.99 });
    });

    it('falls back to the default location, by its saved name', async () => {
        stubGeolocation();
        localStorage.setItem('brooz.location.default', JSON.stringify({ ...PLACE, name: 'Roma' }));
        const invoke = stubBrooz({
            'brooz:weather': () => ({
                status: 'ok',
                data: {
                    ...WEATHER,
                    place: { ...PLACE, name: 'Your location' }
                } satisfies typeof WEATHER
            }),
            'brooz:air-quality': () => new Promise(() => undefined)
        });
        render(<LiveSlot tile={weatherTile} request={request('weather', {})} />);
        expect((await screen.findAllByText('Roma')).length).toBeGreaterThan(0);
        expect(screen.queryByText('Your location')).toBe(null);
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { latitude: 41.9, longitude: 12.5 });
    });

    it('follows a default location change live while the tile is open', async () => {
        stubGeolocation();
        localStorage.setItem('brooz.location.enabled', 'false');
        const invoke = stubBrooz({
            'brooz:weather': () => ({ status: 'ok', data: WEATHER }),
            'brooz:air-quality': () => new Promise(() => undefined)
        });
        render(<LiveSlot tile={weatherTile} request={request('weather', {})} />);
        expect(await screen.findByText('Set a location first.')).toBeTruthy();
        const { result } = renderHook(() => useDefaultLocation());
        act(() => result.current[1](PLACE));
        expect((await screen.findAllByText('Rome')).length).toBeGreaterThan(0);
        await waitFor(() =>
            expect(invoke).toHaveBeenCalledWith('brooz:weather', {
                latitude: 41.9,
                longitude: 12.5
            })
        );
    });

    it('asks for a surf spot before it spends a request', async () => {
        localStorage.clear();
        const invoke = stubBrooz({});
        render(<LiveSlot tile={surfTile} request={request('surf', { city: 'Biarritz' })} />);
        expect(await screen.findByText('Set a surf spot first.')).toBeTruthy();
        expect(invoke).not.toHaveBeenCalled();
    });

    it('loads the surf forecast of the saved spot over the provider channel', async () => {
        localStorage.setItem(
            'brooz.surf.spot',
            JSON.stringify({
                ...PLACE,
                name: 'Ericeira',
                latitude: 38.99,
                longitude: -9.42,
                timezone: 'UTC'
            })
        );
        const invoke = stubBrooz({
            'brooz:surf': () => ({
                status: 'ok',
                data: {
                    hours: [
                        {
                            time: new Date(Date.UTC(2026, 10, 2, 8)).toISOString(),
                            waveHeightM: null,
                            swellPeriodS: null,
                            swellDirection: null,
                            windKmh: null,
                            windDirection: null,
                            waterTemperatureC: null
                        }
                    ],
                    tides: [],
                    fetchedAt: '2026-11-02T08:00:00.000Z'
                }
            })
        });
        render(<LiveSlot tile={surfTile} request={request('surf', {})} />);
        expect(await screen.findByText(/No wave data at this spot/)).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:surf', { latitude: 38.99, longitude: -9.42 });
    });

    it('invites to the settings without a Stormglass key', async () => {
        localStorage.setItem(
            'brooz.surf.spot',
            JSON.stringify({
                ...PLACE,
                name: 'Ericeira',
                latitude: 38.99,
                longitude: -9.42,
                timezone: 'UTC'
            })
        );
        stubBrooz({ 'brooz:surf': () => ({ status: 'missing-key', reason: 'not-set' }) });
        render(<LiveSlot tile={surfTile} request={request('surf', {})} />);
        expect(await screen.findByText('Needs an API key from Stormglass.')).toBeTruthy();
    });

    it('reloads when the key arrives meanwhile', async () => {
        let missing = true;
        stubBrooz({
            'brooz:stock-quotes': () =>
                missing
                    ? { status: 'missing-key', reason: 'not-set' }
                    : {
                          status: 'ok',
                          data: [{ symbol: 'AAPL', price: 189.4, changePercent: null }]
                      }
        });
        render(<LiveSlot tile={tickerTile} request={request('ticker', { symbols: ['AAPL'] })} />);
        expect(await screen.findByText('Needs an API key from Finnhub.')).toBeTruthy();
        missing = false;
        fireEvent.click(screen.getByText('Retry'));
        expect(await screen.findByText('Apple')).toBeTruthy();
    });
});

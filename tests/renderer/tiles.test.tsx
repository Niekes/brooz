import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { tiles } from '../../src/renderer/tiles';
import { AboutTileBody } from '../../src/renderer/tiles/about';
import { AirQuality, LiveAirQuality } from '../../src/renderer/tiles/airQuality';
import { LiveTicker, Ticker } from '../../src/renderer/tiles/ticker';
import { LiveWeather, Weather } from '../../src/renderer/tiles/weather';
import { AIR, WEATHER, stubBrooz } from './stubs';

/** A provider channel's answer with data. */
function ok<T>(data: T): { status: 'ok'; data: T } {
    return { status: 'ok', data };
}

describe('every resting tile', () => {
    beforeEach(() => {
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
    });
    afterEach(() => localStorage.clear());

    it.each(tiles.map((tile) => [tile.id, tile] as const))(
        '%s renders for any seed',
        (_id, { Component }) => {
            for (let seed = 0; seed < 200; seed++) {
                const { container, unmount } = render(<Component seed={seed} />);
                expect(container.firstChild).toBeTruthy();
                unmount();
            }
        }
    );

    it('shows a seeded air quality category on the weather, on the one scale', () => {
        const categories = ['Good', 'Fair', 'Moderate', 'Poor', 'Very poor'];
        render(<Weather seed={4} />);
        const name = screen
            .getByRole('img', { name: /^Air quality: / })
            .getAttribute('aria-label')!;
        expect(categories).toContain(name.replace('Air quality: ', ''));
        render(<AirQuality seed={4} />);
        expect(screen.getByText('OpenWeatherMap index')).toBeTruthy();
        expect(screen.queryByText('US EPA Index')).toBe(null);
    });

    it('shows the resting temperatures in the unit the person chose', () => {
        const toF = (celsius: number): number => Math.round((celsius * 9) / 5 + 32);
        const now = (): number => Number(screen.getByText(/^-?\d+°$/).textContent!.slice(0, -1));

        const { unmount } = render(<Weather seed={0} />);
        const celsius = now();
        unmount();

        localStorage.setItem('brooz.temperature.unit', '"F"');
        render(<Weather seed={0} />);
        expect(now()).toBe(toF(celsius));
    });

    it('is registered with the component its directory exports', () => {
        expect(tiles.map((tile) => tile.Component)).toEqual([
            Weather,
            AirQuality,
            Ticker,
            AboutTileBody
        ]);
    });

    it('has a unique id and title', () => {
        expect(new Set(tiles.map((tile) => tile.id)).size).toBe(tiles.length);
        expect(tiles.every((tile) => tile.title.length > 0)).toBe(true);
    });

    it('remounts a live tile only when its meaningful args change', () => {
        const keys = Object.fromEntries(
            tiles.map((tile) => [
                tile.id,
                [tile.liveKey?.({}), tile.liveKey?.({ city: 'Rome', symbols: ['AAPL', 'TSLA'] })]
            ])
        );
        expect(keys).toMatchObject({
            weather: ['weather:', 'weather:Rome'],
            'air-quality': ['air-quality:', 'air-quality:Rome'],
            ticker: ['ticker:AAPL,MSFT,NVDA', 'ticker:AAPL,TSLA'],
            about: [undefined, undefined]
        });
    });

    it('declares the provider and channel its live tile loads through', () => {
        expect(tiles.map((tile) => tile.providers?.map((p) => [p.provider.id, p.channel]))).toEqual(
            [
                [['openweathermap', 'brooz:weather']],
                [['openweathermap', 'brooz:air-quality']],
                [['finnhub', 'brooz:stock-quotes']],
                undefined
            ]
        );
    });
});

describe('the live tile content', () => {
    beforeEach(() => {
        // The weather card enriches itself with the air quality of its place.
        stubBrooz({ 'brooz:air-quality': () => new Promise(() => undefined) });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('shows the current weather of a city and the next five days', () => {
        render(<LiveWeather args={{ city: 'Rome' }} data={WEATHER} />);
        expect(screen.getByText('Rain')).toBeTruthy();
        expect(screen.getByText('21°')).toBeTruthy();
        expect(screen.getAllByText('Rome').length).toBeGreaterThan(0);
        expect(
            ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((day) => screen.getByText(day))
        ).toHaveLength(5);
        expect(screen.getByText('22')).toBeTruthy();
    });

    it('shows the temperatures in Fahrenheit when the person chose it', () => {
        localStorage.setItem('brooz.temperature.unit', '"F"');
        render(<LiveWeather args={{ city: 'Rome' }} data={WEATHER} />);
        expect(screen.getByText('71°')).toBeTruthy();
        expect(screen.getByText('72')).toBeTruthy();
        expect(screen.getByText('54')).toBeTruthy();
    });

    it.each([
        [1, 'Good'],
        [2, 'Fair'],
        [3, 'Moderate'],
        [4, 'Poor'],
        [5, 'Very poor']
    ])('reads an OpenWeatherMap index of %i as %s', (aqi, label) => {
        render(<LiveAirQuality args={{ city: 'Rome' }} data={{ ...AIR, aqi }} />);
        expect(screen.getByText(label)).toBeTruthy();
    });

    it('shows the air quality category of the weather place once it is there', async () => {
        let answerAir!: (value: unknown) => void;
        const invoke = stubBrooz({
            'brooz:air-quality': () => new Promise((resolve) => (answerAir = resolve))
        });
        render(<LiveWeather args={{ city: 'Rome' }} data={WEATHER} />);
        expect(screen.getByText('21°')).toBeTruthy();
        expect(screen.queryByRole('img', { name: /^Air quality/ })).toBe(null);
        await act(async () => {});
        await act(async () => answerAir(ok({ ...AIR, aqi: 2 })));
        expect(screen.getByRole('img', { name: 'Air quality: Fair' }).textContent).toBe('Fair');
        expect(invoke).toHaveBeenCalledWith('brooz:air-quality', {
            latitude: 41.9,
            longitude: 12.5
        });
    });

    it('keeps the weather and drops the indicator when the air quality is not there', async () => {
        stubBrooz({
            'brooz:air-quality': () => ({ status: 'provider-error', message: 'Offline' })
        });
        render(<LiveWeather args={{ city: 'Rome' }} data={WEATHER} />);
        expect(screen.getByText('21°')).toBeTruthy();
        await act(async () => {});
        expect(screen.queryByRole('img', { name: /^Air quality/ })).toBe(null);
        expect(screen.queryByText('Offline')).toBe(null);
    });

    it('quotes the symbols of the utterance', () => {
        render(
            <LiveTicker
                args={{ symbols: ['AAPL', 'TSLA'] }}
                data={[
                    { symbol: 'AAPL', price: 189.4, changePercent: -1.2 },
                    { symbol: 'TSLA', price: 242.1, changePercent: 2.4 },
                    { symbol: 'SPY', price: 523.7, changePercent: null }
                ]}
            />
        );
        expect(screen.getByText('Apple')).toBeTruthy();
        expect(screen.getByText('189.40')).toBeTruthy();
        expect(screen.getByText('▼ 1.20%')).toBeTruthy();
        expect(screen.getByText('▲ 2.40%')).toBeTruthy();
        expect(screen.getByText('Market')).toBeTruthy();
        expect(screen.getByText('—')).toBeTruthy();
    });
});

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { tiles } from '../../src/renderer/tiles';
import { AboutTileBody } from '../../src/renderer/tiles/about';
import { AirQuality, LiveAirQuality } from '../../src/renderer/tiles/airQuality';
import { Flightracker, LiveFlightracker } from '../../src/renderer/tiles/flightracker';
import { LiveSurf, Surf } from '../../src/renderer/tiles/surf';
import { LiveTicker, Ticker } from '../../src/renderer/tiles/ticker';
import { LiveWeather, Weather } from '../../src/renderer/tiles/weather';
import { AIR, PLACE, WEATHER, stubBrooz } from './stubs';

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
            Surf,
            Flightracker,
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
                [
                    tile.liveKey?.({}),
                    tile.liveKey?.({ city: 'Rome', symbols: ['AAPL', 'TSLA'], flights: ['LH123'] })
                ]
            ])
        );
        expect(keys).toMatchObject({
            weather: ['weather:', 'weather:Rome'],
            'air-quality': ['air-quality:', 'air-quality:Rome'],
            ticker: ['ticker:AAPL,MSFT,NVDA', 'ticker:AAPL,TSLA'],
            surf: ['surf', 'surf'],
            flightracker: ['flightracker:', 'flightracker:LH123'],
            about: [undefined, undefined]
        });
    });

    it('declares the provider and channel its live tile loads through', () => {
        expect(tiles.map((tile) => tile.providers?.map((p) => [p.provider.id, p.channel]))).toEqual(
            [
                [['openweathermap', 'brooz:weather']],
                [['openweathermap', 'brooz:air-quality']],
                [['finnhub', 'brooz:stock-quotes']],
                [['stormglass', 'brooz:surf']],
                [['opensky', 'brooz:flight-states']],
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

    it('shows the live states of the flights the utterance named', () => {
        render(
            <LiveFlightracker
                args={{ flights: ['LH123', 'BA456'] }}
                data={[
                    {
                        callsign: 'DLH123',
                        latitude: 50.1,
                        longitude: 8.7,
                        altitudeM: 10000,
                        speedKmh: 850,
                        onGround: false,
                        lastSeen: '2026-11-02T09:30:00.000Z'
                    },
                    {
                        callsign: 'BA456',
                        latitude: null,
                        longitude: null,
                        altitudeM: null,
                        speedKmh: null,
                        onGround: true,
                        lastSeen: '2026-11-02T09:31:00.000Z'
                    }
                ]}
            />
        );
        expect(screen.getByText('LH123')).toBeTruthy();
        expect(screen.getByText('DLH123 · seen 09:30 UTC')).toBeTruthy();
        expect(screen.getByText('En route')).toBeTruthy();
        expect(screen.getByText('32,808 ft')).toBeTruthy();
        expect(screen.getByText('850 km/h')).toBeTruthy();
        expect(screen.getByText('BA456')).toBeTruthy();
        expect(screen.getByText('On ground')).toBeTruthy();
    });

    it('shows no live state for a flight the feed does not carry', () => {
        render(<LiveFlightracker args={{ flights: ['QF11'] }} data={[]} />);
        expect(screen.getByText('QF11')).toBeTruthy();
        expect(screen.getByText('No live state')).toBeTruthy();
        expect(screen.getByText('No position')).toBeTruthy();
        expect(screen.getByText('—')).toBeTruthy();
    });
});

describe('the live surf content', () => {
    const SPOT = { ...PLACE, name: 'Ericeira', latitude: 38.99, longitude: -9.42, timezone: 'UTC' };
    const at = (hour: number) => new Date(Date.UTC(2026, 10, 2, hour)).toISOString();
    const hour = (index: number) => ({
        time: at(8 + index),
        waveHeightM: 1 + index / 10,
        swellPeriodS: 11,
        swellDirection: 290,
        windKmh: 12,
        windDirection: 80,
        waterTemperatureC: 17
    });
    const FORECAST = {
        hours: Array.from({ length: 12 }, (_, index) => hour(index)),
        tides: [
            { time: '2026-11-02T08:30:00.000Z', type: 'low' as const },
            { time: '2026-11-02T14:10:00.000Z', type: 'high' as const },
            { time: '2026-11-02T20:40:00.000Z', type: 'low' as const },
            { time: '2026-11-03T02:50:00.000Z', type: 'high' as const }
        ],
        fetchedAt: '2026-11-02T08:00:00.000Z'
    };

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 2, 9, 30) });
        localStorage.setItem('brooz.surf.spot', JSON.stringify(SPOT));
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    it('shows the card: rating, best window, the day as bars, range, wind and tides', () => {
        render(<LiveSurf args={{}} data={FORECAST} />);
        expect(screen.getByText('great')).toBeTruthy();
        expect(screen.getByText('Ericeira')).toBeTruthy();
        expect(screen.getByText('Best Surf')).toBeTruthy();
        expect(screen.getByText('8 AM – 12 PM')).toBeTruthy();
        expect(['6 AM', '12 PM', '6 PM'].map((label) => screen.getByText(label))).toHaveLength(3);
        expect(screen.getByText('1-2 m · 11 s')).toBeTruthy();
        expect(screen.getByText('12 km/h')).toBeTruthy();
        expect(screen.getByText('High 14:10 · Low 20:40')).toBeTruthy();
        expect(screen.queryByText('Low 08:30')).toBe(null);
        expect(screen.getByText('updated 08:00')).toBeTruthy();
    });

    it('shows feet and mph in Fahrenheit, and a dash for what is missing', () => {
        localStorage.setItem('brooz.temperature.unit', JSON.stringify('F'));
        vi.setSystemTime(Date.UTC(2026, 10, 2, 7));
        const sparse = {
            ...FORECAST,
            hours: [
                {
                    ...hour(0),
                    swellPeriodS: null,
                    swellDirection: null,
                    windKmh: null,
                    windDirection: null
                },
                hour(1)
            ]
        };
        render(<LiveSurf args={{}} data={sparse} />);
        expect(screen.getByText('fair')).toBeTruthy();
        expect(screen.getByText('8 AM – 10 AM')).toBeTruthy();
        expect(screen.getByText('3-4 ft · –')).toBeTruthy();
        expect(screen.getByText('–')).toBeTruthy();
    });

    it('says no surf today when even the best window is poor', () => {
        const flat = {
            ...FORECAST,
            hours: Array.from({ length: 12 }, (_, index) => ({
                ...hour(index),
                waveHeightM: 0.2,
                swellPeriodS: 4,
                windKmh: 40
            }))
        };
        render(<LiveSurf args={{}} data={flat} />);
        expect(screen.getByText('No surf today')).toBeTruthy();
        expect(screen.getByText('poor')).toBeTruthy();
    });

    it('renders a stub bar for an hour without wave data inside the day', () => {
        const mixed = {
            ...FORECAST,
            hours: [{ ...hour(0), waveHeightM: null }, hour(1), hour(2), hour(3), hour(4)]
        };
        render(<LiveSurf args={{}} data={mixed} />);
        expect(screen.getByText('9 AM – 1 PM')).toBeTruthy();
        expect(screen.getByText('1-1 m · 11 s')).toBeTruthy();
    });

    it('shows no day bars when every forecast hour is past 6 PM at the spot', () => {
        vi.setSystemTime(Date.UTC(2026, 10, 2, 22, 30));
        const night = {
            ...FORECAST,
            hours: [20, 21, 22].map((h) => ({ ...hour(0), time: at(h) }))
        };
        render(<LiveSurf args={{}} data={night} />);
        expect(screen.getByText('No surf today')).toBeTruthy();
        expect(screen.getByText('– · 11 s')).toBeTruthy();
    });

    it('asks to move the spot onto the water when there is no wave data', () => {
        const dry = {
            ...FORECAST,
            hours: [{ ...hour(0), waveHeightM: null, waterTemperatureC: null }]
        };
        render(<LiveSurf args={{}} data={dry} />);
        expect(
            screen.getByText('No wave data at this spot. Move it onto the water in the settings.')
        ).toBeTruthy();
    });
});

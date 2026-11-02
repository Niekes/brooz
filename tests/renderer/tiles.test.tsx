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
import { tiles } from '../../src/renderer/tiles';
import { AboutTileBody } from '../../src/renderer/tiles/about';
import { ActivityRings } from '../../src/renderer/tiles/activityRings';
import { AirQuality, LiveAirQuality } from '../../src/renderer/tiles/airQuality';
import { AnalogClock, LiveAnalogClock } from '../../src/renderer/tiles/analogClock';
import { Calendar } from '../../src/renderer/tiles/calendar';
import { LiveMoon, MoonPhase } from '../../src/renderer/tiles/moonPhase';
import { getMoonPhase } from '../../src/renderer/tiles/moonPhase/moon';
import { NowPlaying } from '../../src/renderer/tiles/nowPlaying';
import { Photo } from '../../src/renderer/tiles/photo';
import { LivePomodoro, Pomodoro } from '../../src/renderer/tiles/pomodoro';
import { LiveNote, StickyNote, migrateStoredNote } from '../../src/renderer/tiles/stickyNote';
import { SystemStats } from '../../src/renderer/tiles/systemStats';
import { LiveTicker, Ticker } from '../../src/renderer/tiles/ticker';
import { LiveWeather, Weather } from '../../src/renderer/tiles/weather';
import { LiveWorldClock, WorldClock } from '../../src/renderer/tiles/worldClock';
import { useDefaultLocation } from '../../src/renderer/shell/kit/hooks';
import { AIR, PLACE, WEATHER, stubBrooz, stubGeolocation } from './stubs';

const live = { label: 'Live', lowConfidence: false };

/** A provider channel's answer with data. */
function ok<T>(data: T): { status: 'ok'; data: T } {
    return { status: 'ok', data };
}

describe('every resting tile', () => {
    beforeEach(() => {
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
    });

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

    it('is registered with the component its directory exports', () => {
        expect(tiles.map((tile) => tile.Component)).toEqual([
            AnalogClock,
            WorldClock,
            Weather,
            NowPlaying,
            ActivityRings,
            SystemStats,
            Ticker,
            Calendar,
            Pomodoro,
            MoonPhase,
            AirQuality,
            StickyNote,
            Photo,
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
                    tile.liveKey?.({
                        city: 'Rome',
                        durationMinutes: 5,
                        action: 'pause',
                        note: 'x',
                        symbols: ['AAPL', 'TSLA']
                    })
                ]
            ])
        );
        expect(keys).toMatchObject({
            weather: ['weather:', 'weather:Rome'],
            'air-quality': ['air-quality:', 'air-quality:Rome'],
            'world-clock': ['world-clock:', 'world-clock:Rome'],
            pomodoro: ['pomodoro:25:', 'pomodoro:5:pause'],
            'sticky-note': ['sticky-note:', 'sticky-note:x'],
            'analog-clock': [undefined, undefined],
            ticker: ['ticker:AAPL,MSFT,NVDA', 'ticker:AAPL,TSLA']
        });
    });
});

describe('the live weather tiles', () => {
    afterEach(() => {
        // The location watch is cleared on unmount, so unmount before unstubbing.
        cleanup();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('shows the current weather of a city and the next five days', async () => {
        stubBrooz({ 'brooz:weather': () => ok(WEATHER) });
        render(<LiveWeather {...live} args={{ city: 'Rome' }} />);
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        expect(await screen.findByText('Rain')).toBeTruthy();
        expect(screen.getByText('21°')).toBeTruthy();
        expect(screen.getAllByText('Rome').length).toBeGreaterThan(0);
        expect(
            ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((day) => screen.getByText(day))
        ).toHaveLength(5);
        expect(screen.getByText('22')).toBeTruthy();
    });

    it.each([
        [1, 'Good'],
        [2, 'Fair'],
        [3, 'Moderate'],
        [4, 'Poor'],
        [5, 'Very poor']
    ])('reads an OpenWeatherMap index of %i as %s', async (aqi, label) => {
        stubBrooz({ 'brooz:air-quality': () => ok({ ...AIR, aqi }) });
        render(<LiveAirQuality {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText(label)).toBeTruthy();
    });

    it('offers a retry when the weather cannot be loaded', async () => {
        stubGeolocation();
        const invoke = stubBrooz({
            'brooz:air-quality': () => Promise.reject(new Error('Offline'))
        });
        render(<LiveAirQuality {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText('Offline')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:air-quality', { city: 'Rome' });
    });

    it('shows the air quality category of the weather place once it is there', async () => {
        let answerAir!: (value: unknown) => void;
        const invoke = stubBrooz({
            'brooz:weather': () => ok(WEATHER),
            'brooz:air-quality': () => new Promise((resolve) => (answerAir = resolve))
        });
        render(<LiveWeather {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText('21°')).toBeTruthy();
        expect(screen.queryByRole('img', { name: /^Air quality/ })).toBe(null);
        await act(async () => answerAir(ok({ ...AIR, aqi: 2 })));
        expect(screen.getByRole('img', { name: 'Air quality: Fair' }).textContent).toBe('Fair');
        expect(invoke).toHaveBeenCalledWith('brooz:air-quality', {
            latitude: 41.9,
            longitude: 12.5
        });
    });

    it('keeps the weather and drops the indicator when the air quality is not there', async () => {
        stubBrooz({
            'brooz:weather': () => ok(WEATHER),
            'brooz:air-quality': () => ({ status: 'provider-error', message: 'Offline' })
        });
        render(<LiveWeather {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText('21°')).toBeTruthy();
        await act(async () => {});
        expect(screen.queryByRole('img', { name: /^Air quality/ })).toBe(null);
        expect(screen.queryByText('Offline')).toBe(null);
    });

    it('invites to the settings without an OpenWeatherMap key', async () => {
        stubBrooz({ 'brooz:weather': () => ({ status: 'missing-key', reason: 'not-set' }) });
        render(<LiveWeather {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText('Needs an API key from OpenWeatherMap.')).toBeTruthy();
    });

    it('shows the device location when there is one', async () => {
        stubGeolocation({ latitude: 53.55, longitude: 9.99 });
        const invoke = stubBrooz({ 'brooz:weather': () => ok(WEATHER) });
        render(<LiveWeather {...live} args={{}} />);
        expect((await screen.findAllByText(WEATHER.place.name)).length).toBeGreaterThan(0);
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { latitude: 53.55, longitude: 9.99 });
    });

    it('falls back to the default location, by its saved name, without a device location', async () => {
        stubGeolocation();
        localStorage.setItem('brooz.location.default', JSON.stringify({ ...PLACE, name: 'Roma' }));
        const invoke = stubBrooz({
            'brooz:weather': () => ok({ ...WEATHER, place: { ...PLACE, name: 'Your location' } })
        });
        render(<LiveWeather {...live} args={{}} />);
        expect((await screen.findAllByText('Roma')).length).toBeGreaterThan(0);
        expect(screen.queryByText('Your location')).toBe(null);
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { latitude: 41.9, longitude: 12.5 });
    });

    it('asks for a location without a device location and without a default one', () => {
        stubGeolocation();
        const invoke = stubBrooz({});
        render(<LiveWeather {...live} args={{}} />);
        expect(screen.getByText('Set a location first.')).toBeTruthy();
        render(<LiveAirQuality {...live} args={{}} />);
        expect(screen.getAllByText('Set a location first.')).toHaveLength(2);
        expect(invoke).not.toHaveBeenCalled();
    });

    it('never asks for the device location once it is off, and follows the default location live', async () => {
        localStorage.setItem('brooz.location.enabled', 'false');
        const getCurrentPosition = vi.fn();
        vi.stubGlobal('navigator', {
            userAgent: navigator.userAgent,
            geolocation: { getCurrentPosition, watchPosition: getCurrentPosition }
        });
        const invoke = stubBrooz({ 'brooz:weather': () => ok(WEATHER) });
        render(<LiveWeather {...live} args={{}} />);
        expect(screen.getByText('Set a location first.')).toBeTruthy();
        const { result } = renderHook(() => useDefaultLocation());
        act(() => result.current[1](PLACE));
        expect((await screen.findAllByText('Rome')).length).toBeGreaterThan(0);
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { latitude: 41.9, longitude: 12.5 });
        act(() => result.current[1](null));
        expect(screen.getByText('Set a location first.')).toBeTruthy();
        expect(getCurrentPosition).not.toHaveBeenCalled();
    });
});

describe('the live clocks', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(new Date('2026-10-24T10:20:30Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ticks the analog clock', () => {
        const { container } = render(<LiveAnalogClock {...live} args={{}} />);
        expect(container.querySelectorAll('line').length).toBe(63);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('Local')).toBeTruthy();
    });

    it('shows the local time when no city was named', () => {
        stubBrooz({});
        render(<LiveWorldClock {...live} args={{}} />);
        expect(screen.getByText('Local')).toBeTruthy();
        expect(screen.getByText(/· local$/)).toBeTruthy();
    });

    it('shows the time in a city once it is found', async () => {
        stubBrooz({ 'brooz:geocode': () => ({ ...PLACE, timezone: 'Asia/Tokyo' }) });
        render(<LiveWorldClock {...live} args={{ city: 'Tokyo' }} />);
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        await waitFor(() => expect(screen.getByText('19:20')).toBeTruthy());
        expect(screen.getByText('GMT+9 · Asia/Tokyo')).toBeTruthy();
    });

    it('offers a retry when the city is unknown', async () => {
        stubBrooz({ 'brooz:geocode': () => Promise.reject(new Error('Unknown city')) });
        render(<LiveWorldClock {...live} args={{ city: 'Atlantis' }} />);
        await waitFor(() => expect(screen.getByText('Unknown city')).toBeTruthy());
    });
});

describe('the moon', () => {
    it('knows the phase of a date', () => {
        expect(getMoonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toMatchObject({
            name: 'New Moon',
            waxing: true,
            daysUntilFull: 15
        });
        const full = getMoonPhase(new Date(Date.UTC(2000, 0, 21, 12)));
        expect(full).toMatchObject({ name: 'Full Moon', daysUntilFull: 0 });
        expect(full.illumination).toBeGreaterThan(0.99);
        expect(getMoonPhase(new Date(Date.UTC(1999, 11, 30))).waxing).toBe(false);
    });

    it.each([
        ['2000-01-08T00:00:00Z', 'Waxing', ' · in 14 days'],
        ['2000-01-21T12:00:00Z', 'Waxing', ' · today'],
        ['2000-01-30T00:00:00Z', 'Waning', ' · in 21 days']
    ])('shows tonight on %s', (now, meta, until) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(now));
        const { container } = render(<LiveMoon {...live} args={{}} />);
        expect(screen.getByText(meta)).toBeTruthy();
        expect(container.textContent).toContain(until);
        vi.useRealTimers();
    });
});

describe('the live pomodoro', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('waits until it is started, then counts down and pauses', () => {
        render(<LivePomodoro {...live} args={{ durationMinutes: 1 }} />);
        expect(screen.getByText('Ready')).toBeTruthy();
        expect(screen.getByText('01:00')).toBeTruthy();
        fireEvent.click(screen.getByText('Start'));
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText('00:59')).toBeTruthy();
        expect(screen.getByText('In focus')).toBeTruthy();
        fireEvent.click(screen.getByText('Pause'));
        expect(screen.getByText('Paused')).toBeTruthy();
        fireEvent.click(screen.getByText('Reset'));
        expect(screen.getByText('Ready')).toBeTruthy();
    });

    it('starts on its own when asked, completes and goes again', () => {
        render(<LivePomodoro {...live} args={{ durationMinutes: 0.02, action: 'start' }} />);
        for (let second = 0; second < 60; second++) {
            act(() => {
                vi.advanceTimersByTime(1000);
            });
        }
        expect(screen.getByText('Complete')).toBeTruthy();
        fireEvent.click(screen.getByText('Again'));
        expect(screen.getByText('In focus')).toBeTruthy();
    });

    it('defaults to 25 minutes', () => {
        render(<LivePomodoro {...live} args={{}} />);
        expect(screen.getByText('25:00')).toBeTruthy();
        expect(screen.getByText('25 min')).toBeTruthy();
    });
});

describe('the live sticky note', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts from the utterance, saves and clears', () => {
        render(<LiveNote {...live} args={{ note: 'buy milk' }} />);
        expect(screen.getByDisplayValue('buy milk')).toBeTruthy();
        expect(screen.getByText('8 chars')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(350);
        });
        expect(localStorage.getItem('brooz.note.v1')).toBe('"buy milk"');
        expect(screen.getByText('Saved')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(1600);
        });
        expect(screen.getByText('Local')).toBeTruthy();

        fireEvent.change(screen.getByLabelText('Sticky note'), { target: { value: 'x' } });
        expect(screen.getByText('Saving')).toBeTruthy();
        expect(screen.getByText('1 char')).toBeTruthy();
        fireEvent.click(screen.getByText('Clear'));
        expect(screen.getByDisplayValue('')).toBeTruthy();
    });

    it('starts empty when nothing was saved', () => {
        render(<LiveNote {...live} args={{}} />);
        expect(screen.getByText('0 chars')).toBeTruthy();
    });

    it('starts from the saved note', () => {
        localStorage.setItem('brooz.note.v1', '"saved before"');
        render(<LiveNote {...live} args={{}} />);
        expect(screen.getByDisplayValue('saved before')).toBeTruthy();
    });

    it('migrates a note saved as raw text, and leaves a JSON note alone', () => {
        localStorage.setItem('brooz.note.v1', 'buy milk');
        migrateStoredNote(localStorage);
        expect(localStorage.getItem('brooz.note.v1')).toBe('"buy milk"');
        migrateStoredNote(localStorage);
        expect(localStorage.getItem('brooz.note.v1')).toBe('"buy milk"');

        localStorage.setItem('brooz.note.v1', '42');
        migrateStoredNote(localStorage);
        expect(localStorage.getItem('brooz.note.v1')).toBe('"42"');

        localStorage.clear();
        migrateStoredNote(localStorage);
        expect(localStorage.getItem('brooz.note.v1')).toBeNull();
    });
});

describe('the live markets tile', () => {
    it('quotes the symbols of the utterance', async () => {
        stubBrooz({
            'brooz:stock-quotes': () => ({
                status: 'ok',
                data: [
                    { symbol: 'AAPL', price: 189.4, changePercent: -1.2 },
                    { symbol: 'TSLA', price: 242.1, changePercent: 2.4 },
                    { symbol: 'SPY', price: 523.7, changePercent: null }
                ]
            })
        });
        render(<LiveTicker {...live} args={{ symbols: ['AAPL', 'TSLA'] }} />);
        expect(await screen.findByText('Apple')).toBeTruthy();
        expect(screen.getByText('189.40')).toBeTruthy();
        expect(screen.getByText('▼ 1.20%')).toBeTruthy();
        expect(screen.getByText('▲ 2.40%')).toBeTruthy();
        expect(screen.getByText('Market')).toBeTruthy();
        expect(screen.getByText('—')).toBeTruthy();
    });

    it('quotes a default watchlist without symbols', async () => {
        const invoke = stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'ok', data: [] }) });
        render(<LiveTicker {...live} args={{}} />);
        await waitFor(() =>
            expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes', ['AAPL', 'MSFT', 'NVDA'])
        );
    });

    it('invites to the settings while the key is missing', async () => {
        stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'missing-key', reason: 'not-set' }) });
        render(<LiveTicker {...live} args={{}} />);
        expect(await screen.findByText('Needs an API key from Finnhub.')).toBeTruthy();
    });

    it('explains when the system cannot store keys', async () => {
        stubBrooz({
            'brooz:stock-quotes': () => ({
                status: 'missing-key',
                reason: 'encryption-unavailable'
            })
        });
        render(<LiveTicker {...live} args={{}} />);
        expect(
            await screen.findByText('This system offers no encrypted place for a Finnhub key.')
        ).toBeTruthy();
    });

    it('caps a long watchlist at the five symbols of the contract', async () => {
        const invoke = stubBrooz({ 'brooz:stock-quotes': () => ({ status: 'ok', data: [] }) });
        render(<LiveTicker {...live} args={{ symbols: ['A', 'B', 'C', 'D', 'E', 'F'] }} />);
        await waitFor(() =>
            expect(invoke).toHaveBeenCalledWith('brooz:stock-quotes', ['A', 'B', 'C', 'D', 'E'])
        );
    });

    it('shows the provider error with a retry', async () => {
        stubBrooz({
            'brooz:stock-quotes': () => ({
                status: 'provider-error',
                message: 'Finnhub replied with 401.'
            })
        });
        render(<LiveTicker {...live} args={{}} />);
        expect(await screen.findByText('Finnhub replied with 401.')).toBeTruthy();
    });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { tiles } from '../../src/renderer/tiles';
import { AboutTileBody } from '../../src/renderer/tiles/about';
import { ActivityRings } from '../../src/renderer/tiles/activityRings';
import { AirQuality, LiveAirQuality } from '../../src/renderer/tiles/airQuality';
import { AnalogClock, LiveAnalogClock } from '../../src/renderer/tiles/analogClock';
import { Calendar } from '../../src/renderer/tiles/calendar';
import { Forecast, LiveForecast } from '../../src/renderer/tiles/forecast';
import { LiveMoon, MoonPhase } from '../../src/renderer/tiles/moonPhase';
import { getMoonPhase } from '../../src/renderer/tiles/moonPhase/moon';
import { NowPlaying } from '../../src/renderer/tiles/nowPlaying';
import { Photo } from '../../src/renderer/tiles/photo';
import { LivePomodoro, Pomodoro } from '../../src/renderer/tiles/pomodoro';
import { LiveNote, StickyNote } from '../../src/renderer/tiles/stickyNote';
import { SystemStats } from '../../src/renderer/tiles/systemStats';
import { Ticker } from '../../src/renderer/tiles/ticker';
import { LiveWeather, Weather } from '../../src/renderer/tiles/weather';
import { LiveWorldClock, WorldClock } from '../../src/renderer/tiles/worldClock';
import { AIR, PLACE, WEATHER, stubBrooz } from './stubs';

const live = { label: 'Live', lowConfidence: false };

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

    it('is registered with the component its directory exports', () => {
        expect(tiles.map((tile) => tile.Component)).toEqual([
            AnalogClock,
            WorldClock,
            Weather,
            Forecast,
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
                    tile.liveKey?.({ city: 'Rome', durationMinutes: 5, action: 'pause', note: 'x' })
                ]
            ])
        );
        expect(keys).toMatchObject({
            weather: ['weather:', 'weather:Rome'],
            forecast: ['forecast:', 'forecast:Rome'],
            'air-quality': ['air-quality:', 'air-quality:Rome'],
            'world-clock': ['world-clock:', 'world-clock:Rome'],
            pomodoro: ['pomodoro:25:', 'pomodoro:5:pause'],
            'sticky-note': ['sticky-note:', 'sticky-note:x'],
            'analog-clock': [undefined, undefined]
        });
    });
});

describe('the live weather tiles', () => {
    it('shows the current weather of a city', async () => {
        stubBrooz({ 'brooz:weather': () => WEATHER });
        render(<LiveWeather {...live} args={{ city: 'Rome' }} />);
        expect(screen.getByLabelText('Loading live data')).toBeTruthy();
        expect(await screen.findByText('Rain')).toBeTruthy();
        expect(screen.getByText('Rome')).toBeTruthy();
        expect(screen.getByText('HUM 55%')).toBeTruthy();
    });

    it('shows five days and how many are rainy', async () => {
        stubBrooz({ 'brooz:weather': () => WEATHER });
        const { rerender } = render(<LiveForecast {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText('Today')).toBeTruthy();
        expect(screen.getByText('Rain likely on 1 day')).toBeTruthy();

        const rainy = WEATHER.daily.map((day) => ({ ...day, precipitationProbability: 90 }));
        stubBrooz({ 'brooz:weather': () => ({ ...WEATHER, daily: rainy }) });
        rerender(<LiveForecast {...live} args={{ city: 'Oslo' }} />);
        expect(await screen.findByText('Rain likely on 5 days')).toBeTruthy();

        const dry = WEATHER.daily.map((day) => ({ ...day, precipitationProbability: 0 }));
        stubBrooz({ 'brooz:weather': () => ({ ...WEATHER, daily: dry }) });
        rerender(<LiveForecast {...live} args={{ city: 'Cairo' }} />);
        expect(await screen.findByText('No rain expected')).toBeTruthy();
    });

    it.each([
        [10, 'Good'],
        [30, 'Fair'],
        [50, 'Moderate'],
        [70, 'Poor'],
        [90, 'Very poor'],
        [150, 'Extremely poor']
    ])('reads a European AQI of %i as %s', async (aqi, label) => {
        stubBrooz({ 'brooz:air-quality': () => ({ ...AIR, aqi }) });
        render(<LiveAirQuality {...live} args={{ city: 'Rome' }} />);
        expect(await screen.findByText(label)).toBeTruthy();
    });

    it('offers a retry when the weather cannot be loaded', async () => {
        const invoke = stubBrooz({
            'brooz:air-quality': () => Promise.reject(new Error('Offline'))
        });
        render(<LiveAirQuality {...live} args={{}} />);
        expect(await screen.findByText('Offline')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:air-quality', { city: 'Berlin' });
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
        expect(localStorage.getItem('brooz.note.v1')).toBe('buy milk');
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
        localStorage.setItem('brooz.note.v1', 'saved before');
        render(<LiveNote {...live} args={{}} />);
        expect(screen.getByDisplayValue('saved before')).toBeTruthy();
    });

    it('works without storage', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        render(<LiveNote {...live} args={{}} />);
        expect(screen.getByDisplayValue('')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(350);
        });
        expect(screen.getByText('Local')).toBeTruthy();
    });
});

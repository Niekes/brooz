import { describe, expect, it } from 'vite-plus/test';
import { argsFor, routedTile } from '../../../src/renderer/shell/command/manifest';
import { parseCommand } from '../../../src/renderer/shell/command/parse';

const args = (text: string) => parseCommand(text).args;

describe('the rules', () => {
    it('find nothing in an empty or unrelated utterance', () => {
        expect(parseCommand('')).toEqual({
            best: null,
            matches: [],
            args: expect.any(Object) as object
        });
        expect(parseCommand('hello there').best).toBe(null);
    });

    it('rank up to three tiles, the clearest winner most confident', () => {
        const { best, matches } = parseCommand('weather in Rome');
        expect(best).toEqual({
            widget: 'weather',
            confidence: 0.95,
            args: { city: 'Rome' },
            source: 'rules'
        });
        expect(matches[0]).toBe(best);
    });

    it('judge the winner by its lead and the others by their gaps', () => {
        const { matches } = parseCommand('clock timer');
        expect(matches.map((match) => match.widget)).toEqual([
            'pomodoro',
            'analog-clock',
            'world-clock'
        ]);
        expect(matches.map((match) => match.confidence.toFixed(2))).toEqual([
            '0.75',
            '0.65',
            '0.65'
        ]);
    });

    it('look uncertain on a tie', () => {
        const { matches } = parseCommand('lunar rings');
        expect(matches.map((match) => match.confidence)).toEqual([0.55, 0.55]);
    });

    it('cap a runner-up by how far it trails', () => {
        const { matches } = parseCommand('weather forecast air quality in Oslo');
        expect(matches).toHaveLength(3);
        for (const match of matches.slice(1)) {
            expect(match.confidence).toBeGreaterThanOrEqual(0.55);
            expect(match.confidence).toBeLessThanOrEqual(0.95);
        }
    });
});

describe('the city', () => {
    it.each([
        ['weather in rome', 'Rome'],
        ['time at new york city', 'New York City'],
        ['weather at noon, in Oslo', 'Oslo'],
        ['time in Berlin and London', 'Berlin'],
        ['weather in Rome tomorrow', 'Rome'],
        ['what time is it in st. petersburg', 'St. Petersburg']
    ])('comes out of "%s"', (text, city) => {
        expect(args(text).city).toBe(city);
    });

    it.each([
        'weather in the morning',
        'timer for 5 minutes',
        'forecast for tonight',
        'weather for minutes',
        'weather for now please',
        'forecast for next week'
    ])('is not taken from "%s"', (text) => {
        expect(args(text).city).toBeUndefined();
    });
});

describe('the duration', () => {
    it.each([
        ['start a 25 minute timer', 25],
        ['timer 500 mins', 180],
        ['focus for 1.5 hours', 90],
        ['focus 0 min', 1],
        ['half an hour timer', 30],
        ['focus for an hour', 60],
        ['start a timer', undefined]
    ])('of "%s" is %s', (text, minutes) => {
        expect(args(text).durationMinutes).toBe(minutes);
    });
});

describe('the note', () => {
    it.each([
        ['remind me to call mom', 'call mom'],
        ['remind me water the plants', 'water the plants'],
        ['note: buy milk', 'buy milk'],
        ['remember to buy eggs', 'buy eggs'],
        ['jot down - call the plumber', 'call the plumber'],
        ['create a sticky note for the meeting', 'the meeting'],
        ['add note about taxes', 'taxes'],
        ['show my notes', undefined]
    ])('of "%s" is %s', (text, note) => {
        expect(args(text).note).toBe(note);
    });
});

describe('the query', () => {
    it.each([
        ['play some jazz', 'jazz'],
        ['play Miles Davis!', 'Miles Davis'],
        ['play music', undefined],
        ['play something', undefined],
        ['play the next song', undefined],
        ['play track', undefined],
        ['show me a photo of mountains', 'mountains'],
        ['find a picture of the ocean.', 'the ocean'],
        ['picture of a dog', 'a dog'],
        ['search for cats', 'cats'],
        ['show my photos', undefined]
    ])('of "%s" is %s', (text, query) => {
        expect(args(text).query).toBe(query);
    });
});

describe('the time words and actions', () => {
    it.each([
        ['meetings tomorrow', 'tomorrow'],
        ['meetings tonight', 'today'],
        ['meetings today', 'today'],
        ['forecast next week', 'next week'],
        ['events this week', 'this week'],
        ['events', undefined]
    ])('"%s" happens %s', (text, when) => {
        expect(args(text).when).toBe(when);
    });

    it.each([
        ['pause the music', 'pause'],
        ['stop the timer', 'pause'],
        ['reset the pomodoro', 'reset'],
        ['skip this track', 'next'],
        ['next song', 'next'],
        ['skip to next week', undefined],
        ['resume the music', 'play'],
        ['begin a focus session', 'start'],
        ['play some jazz', 'play'],
        ['show a clock', undefined]
    ])('"%s" is the action %s', (text, action) => {
        expect(args(text).action).toBe(action);
    });
});

describe('the symbols', () => {
    it('come from company names and upper-case tickers', () => {
        expect(args('compare apple and NVDA, I want A price')).toMatchObject({
            symbols: ['AAPL', 'NVDA']
        });
        expect(args('bitcoin price').symbols).toEqual(['BTC-USD']);
        expect(args('price of gold').symbols).toBeUndefined();
    });
});

describe('the args of a tile', () => {
    const all = {
        city: 'Rome',
        durationMinutes: 5,
        note: 'milk',
        query: 'jazz',
        symbols: ['AAPL'],
        when: 'today' as const,
        action: 'pause' as const
    };

    it.each([
        ['weather', { city: 'Rome' }],
        ['forecast', { city: 'Rome' }],
        ['air-quality', { city: 'Rome' }],
        ['world-clock', { city: 'Rome' }],
        ['pomodoro', { durationMinutes: 5, action: 'pause' }],
        ['sticky-note', { note: 'milk' }],
        ['photo-tile', { query: 'jazz' }],
        ['now-playing', { query: 'jazz', action: 'pause' }],
        ['calendar', { when: 'today' }],
        ['ticker', { symbols: ['AAPL'], query: 'jazz' }],
        ['moon-phase', {}],
        ['analog-clock', {}],
        ['about', {}],
        ['not-a-tile', {}]
    ])('%s keeps %j', (id, kept) => {
        expect(argsFor(id, all)).toEqual(kept);
    });

    it('starts a pomodoro unless told otherwise', () => {
        expect(argsFor('pomodoro', {})).toEqual({ durationMinutes: undefined, action: 'start' });
    });

    it('routes only tiles with a route', () => {
        expect(routedTile('weather')?.title).toBe('Weather');
        expect(routedTile('about')).toBeUndefined();
    });
});

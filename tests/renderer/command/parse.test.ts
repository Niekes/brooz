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
        const { matches } = parseCommand('weather air quality stocks');
        expect(matches.map((match) => match.widget)).toEqual(['air-quality', 'weather', 'ticker']);
        expect(matches.map((match) => match.confidence.toFixed(2))).toEqual([
            '0.77',
            '0.72',
            '0.72'
        ]);
    });

    it('look uncertain on a tie', () => {
        const { matches } = parseCommand('weekend bitcoin');
        expect(matches.map((match) => match.confidence)).toEqual([0.55, 0.55]);
    });

    it('cap a runner-up by how far it trails', () => {
        const { matches } = parseCommand('weather forecast air quality in Oslo');
        expect(matches).toHaveLength(2);
        for (const match of matches.slice(1)) {
            expect(match.confidence).toBeGreaterThanOrEqual(0.55);
            expect(match.confidence).toBeLessThanOrEqual(0.95);
        }
    });
});

describe('the city', () => {
    it.each([
        ['weather in rome', 'Rome'],
        ['air quality at new york city', 'New York City'],
        ['weather at noon, in Oslo', 'Oslo'],
        ['weather in Berlin and London', 'Berlin'],
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

describe('the symbols', () => {
    it('come from company names and upper-case tickers', () => {
        expect(args('compare apple and NVDA, I want A price')).toMatchObject({
            symbols: ['AAPL', 'NVDA']
        });
        expect(args('bitcoin price').symbols).toEqual(['BTC-USD']);
        expect(args('price of gold').symbols).toBeUndefined();
    });
});

describe('the flights', () => {
    it('come from flight numbers in the utterance', () => {
        expect(args('where is flight lh123')).toMatchObject({ flights: ['LH123'] });
        expect(args('track DLH4321 and ba456')).toMatchObject({ flights: ['DLH4321', 'BA456'] });
        expect(args('price of apple').flights).toBeUndefined();
        expect(args('weather in Rome').flights).toBeUndefined();
    });
});

describe('the args of a tile', () => {
    const all = {
        city: 'Rome',
        symbols: ['AAPL'],
        flights: ['LH123']
    };

    it.each([
        ['weather', { city: 'Rome' }],
        ['air-quality', { city: 'Rome' }],
        ['ticker', { symbols: ['AAPL'] }],
        ['flightracker', { flights: ['LH123'] }],
        ['about', {}],
        ['not-a-tile', {}]
    ])('%s keeps %j', (id, kept) => {
        expect(argsFor(id, all)).toEqual(kept);
    });

    it('routes only tiles with a route', () => {
        expect(routedTile('weather')?.title).toBe('Weather');
        expect(routedTile('about')).toBeUndefined();
    });
});

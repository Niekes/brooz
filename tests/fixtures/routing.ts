/**
 * The routing benchmarks from the dashboard prototype. The development set
 * was used while tuning the rules and the model descriptions; the holdout
 * sets were written independently of it, to estimate whether a route
 * generalizes. They are tests, never shown to a person.
 */

export interface RoutingCase {
    text: string;
    expected: string;
}

/** Three cases per tile, phrased unlike the route descriptions and examples. */
export const DEVELOPMENT_SET: readonly RoutingCase[] = [
    // weather
    { text: 'weather in Rome', expected: 'weather' },
    { text: 'is it raining in Seattle right now', expected: 'weather' },
    { text: 'how hot is it in Cairo today', expected: 'weather' },

    // weather: forecast
    { text: '5 day forecast for Berlin', expected: 'weather' },
    { text: 'will it rain this weekend in Lisbon', expected: 'weather' },
    { text: 'weather outlook for next week in Oslo', expected: 'weather' },

    // air-quality
    { text: 'air quality in Beijing', expected: 'air-quality' },
    { text: 'how polluted is the air in Delhi', expected: 'air-quality' },
    { text: 'show the AQI for London', expected: 'air-quality' },

    // ticker
    { text: 'how is apple stock doing', expected: 'ticker' },
    { text: 'show me the price of bitcoin', expected: 'ticker' },
    { text: 'market overview for tesla and nvidia', expected: 'ticker' },

    // surf
    { text: 'is it worth surfing today', expected: 'surf' },
    { text: 'how big is the swell this morning', expected: 'surf' },
    { text: 'when is high tide', expected: 'surf' }
];

export const HOLDOUT_SET: readonly RoutingCase[] = [
    { text: 'how hot is it in Madrid', expected: 'weather' },
    { text: 'is it windy in Lisbon', expected: 'weather' },
    { text: 'will it rain in Amsterdam this weekend', expected: 'weather' },
    { text: 'give me the five day forecast for Berlin', expected: 'weather' },
    { text: 'how polluted is the air in Beijing', expected: 'air-quality' },
    { text: 'air quality in Sydney', expected: 'air-quality' },
    { text: 'how are the markets doing today', expected: 'ticker' },
    { text: "what's Apple's stock price", expected: 'ticker' },
    { text: 'is it worth surfing today', expected: 'surf' },
    { text: 'how big is the swell', expected: 'surf' }
];

/** A second holdout set, written after the first pass but before testing. */
export const HOLDOUT_SET_2: readonly RoutingCase[] = [
    { text: 'temperature in Cairo', expected: 'weather' },
    { text: 'do I need an umbrella in Rome', expected: 'weather' },
    { text: 'smog levels in Delhi', expected: 'air-quality' },
    { text: 'how is the stock market', expected: 'ticker' },
    { text: "how's the air in Paris", expected: 'air-quality' },
    { text: "what's the weather like in Oslo", expected: 'weather' },
    { text: 'stock price of Microsoft', expected: 'ticker' },
    { text: 'when is high tide', expected: 'surf' }
];

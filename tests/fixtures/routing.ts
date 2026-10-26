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
    // analog-clock
    { text: 'show me a clock', expected: 'analog-clock' },
    { text: 'I want a classic clock face on screen', expected: 'analog-clock' },
    { text: 'put a big watch in the middle', expected: 'analog-clock' },

    // world-clock
    { text: 'what time is it in Tokyo', expected: 'world-clock' },
    { text: 'current local time in New York', expected: 'world-clock' },
    { text: 'show me the time in Berlin and London', expected: 'world-clock' },

    // weather
    { text: 'weather in Rome', expected: 'weather' },
    { text: 'is it raining in Seattle right now', expected: 'weather' },
    { text: 'how hot is it in Cairo today', expected: 'weather' },

    // forecast
    { text: '5 day forecast for Berlin', expected: 'forecast' },
    { text: 'will it rain this weekend in Lisbon', expected: 'forecast' },
    { text: 'weather outlook for next week in Oslo', expected: 'forecast' },

    // air-quality
    { text: 'air quality in Beijing', expected: 'air-quality' },
    { text: 'how polluted is the air in Delhi', expected: 'air-quality' },
    { text: 'show the AQI for London', expected: 'air-quality' },

    // now-playing
    { text: 'play some jazz', expected: 'now-playing' },
    { text: 'pause the music', expected: 'now-playing' },
    { text: 'skip to the next song', expected: 'now-playing' },

    // activity-rings
    { text: 'show my activity rings', expected: 'activity-rings' },
    { text: 'how many calories did I burn today', expected: 'activity-rings' },
    { text: 'did I close my move goal', expected: 'activity-rings' },

    // system-stats
    { text: 'how is my cpu doing', expected: 'system-stats' },
    { text: 'show memory usage', expected: 'system-stats' },
    { text: 'is the machine under load', expected: 'system-stats' },

    // ticker
    { text: 'how is apple stock doing', expected: 'ticker' },
    { text: 'show me the price of bitcoin', expected: 'ticker' },
    { text: 'market overview for tesla and nvidia', expected: 'ticker' },

    // calendar
    { text: "what's on my calendar tomorrow", expected: 'calendar' },
    { text: 'show my meetings for today', expected: 'calendar' },
    { text: 'do I have any appointments this week', expected: 'calendar' },

    // pomodoro
    { text: 'start a 25 minute timer', expected: 'pomodoro' },
    { text: 'begin a focus session', expected: 'pomodoro' },
    { text: 'reset the pomodoro', expected: 'pomodoro' },

    // moon-phase
    { text: "what's the moon phase tonight", expected: 'moon-phase' },
    { text: 'show the lunar calendar', expected: 'moon-phase' },
    { text: 'is it a full moon today', expected: 'moon-phase' },

    // sticky-note
    { text: 'note: buy milk', expected: 'sticky-note' },
    { text: 'write down call the dentist', expected: 'sticky-note' },
    { text: 'create a sticky note for the meeting', expected: 'sticky-note' },

    // photo-tile
    { text: 'show me a photo of mountains', expected: 'photo-tile' },
    { text: 'find a picture of the ocean', expected: 'photo-tile' },
    { text: 'display a photo of a city at night', expected: 'photo-tile' },

    // settings
    { text: 'open the settings', expected: 'settings' },
    { text: 'add an api key', expected: 'settings' },
    { text: 'manage my api keys', expected: 'settings' }
];

export const HOLDOUT_SET: readonly RoutingCase[] = [
    { text: 'display a round clock with hands', expected: 'analog-clock' },
    { text: 'show me the clock face', expected: 'analog-clock' },
    { text: "what's the time in Singapore right now", expected: 'world-clock' },
    { text: 'what time is it in Los Angeles', expected: 'world-clock' },
    { text: 'how hot is it in Madrid', expected: 'weather' },
    { text: 'is it windy in Lisbon', expected: 'weather' },
    { text: 'will it rain in Amsterdam this weekend', expected: 'forecast' },
    { text: 'give me the five day forecast for Berlin', expected: 'forecast' },
    { text: 'how polluted is the air in Beijing', expected: 'air-quality' },
    { text: 'air quality in Sydney', expected: 'air-quality' },
    { text: 'how are the markets doing today', expected: 'ticker' },
    { text: "what's Apple's stock price", expected: 'ticker' },
    { text: "what's on my schedule tomorrow", expected: 'calendar' },
    { text: 'do I have any appointments tomorrow', expected: 'calendar' },
    { text: 'what song is playing', expected: 'now-playing' },
    { text: 'skip this track', expected: 'now-playing' },
    { text: 'show me a picture of the mountains', expected: 'photo-tile' },
    { text: 'how much CPU and RAM is in use', expected: 'system-stats' },
    { text: 'how close am I to my move goal', expected: 'activity-rings' },
    { text: 'start a 45 minute focus session', expected: 'pomodoro' },
    { text: 'jot down call the plumber', expected: 'sticky-note' },
    { text: "what's the moon doing tonight", expected: 'moon-phase' }
];

/** A second holdout set, written after the first pass but before testing. */
export const HOLDOUT_SET_2: readonly RoutingCase[] = [
    { text: 'temperature in Cairo', expected: 'weather' },
    { text: 'do I need an umbrella in Rome', expected: 'forecast' },
    { text: 'smog levels in Delhi', expected: 'air-quality' },
    { text: 'how is the stock market', expected: 'ticker' },
    { text: "what's next on my calendar", expected: 'calendar' },
    { text: 'any events on Friday', expected: 'calendar' },
    { text: 'play the next song', expected: 'now-playing' },
    { text: 'find a photo of a forest', expected: 'photo-tile' },
    { text: 'show memory usage', expected: 'system-stats' },
    { text: 'how many calories have I burned', expected: 'activity-rings' },
    { text: 'begin a focus session', expected: 'pomodoro' },
    { text: 'remind me to water the plants', expected: 'sticky-note' },
    { text: "what's playing right now", expected: 'now-playing' },
    { text: "how's the air in Paris", expected: 'air-quality' },
    { text: "what's the weather like in Oslo", expected: 'weather' },
    { text: 'show my fitness rings', expected: 'activity-rings' },
    { text: "what's the local time in Dubai", expected: 'world-clock' },
    { text: 'is the moon full tonight', expected: 'moon-phase' },
    { text: 'stock price of Microsoft', expected: 'ticker' }
];

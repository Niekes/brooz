import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { IpcChannel } from '../../../shared/ipc';
import { OPEN_SKY } from '../../../shared/providers';
import { callsignMatches, flightPhase, formatAltitude, formatSpeed } from '../../../shared/flights';
import type { FlightState } from '../../../shared/flights';
import { MAX_FLIGHTS } from '../../../shared/flights';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { useProviderData } from '../../shell/kit/hooks';
import { rng } from '../../shell/kit/seed';
import type {
    CommandArgs,
    LiveLoader,
    LiveTileProps,
    TileDefinition,
    TileProps
} from '../../shell/tile';

/** The seeded mock board: flights a cell shows at rest, with their routes. */
const MOCK_FLIGHTS = [
    { callsign: 'LH123', route: 'FRA → JFK', status: 'On time' },
    { callsign: 'BA456', route: 'LHR → CDG', status: 'Boarding' },
    { callsign: 'UA900', route: 'SFO → DEN', status: 'Delayed' },
    { callsign: 'AF1007', route: 'CDG → LIS', status: 'On time' },
    { callsign: 'EK202', route: 'DXB → LHR', status: 'En route' },
    { callsign: 'QF11', route: 'SIN → SYD', status: 'Landed' }
];

/** The phase badge colors, as literal Tailwind classes. */
const PHASE_STYLE: Record<string, string> = {
    'en-route': 'border-[#5eead4]/40 bg-[#5eead4]/10 text-[#5eead4]',
    'on-ground': 'border-[#fcd34d]/40 bg-[#fcd34d]/10 text-[#fcd34d]',
    'no-position': 'border-white/15 bg-white/5 text-white/50'
};

const PHASE_LABEL: Record<string, string> = {
    'en-route': 'En route',
    'on-ground': 'On ground',
    'no-position': 'No position'
};

/** One seeded mock row: a flight, its route, status and progress along it. */
function MockRow({
    seed,
    flight
}: {
    seed: number;
    flight: (typeof MOCK_FLIGHTS)[number];
}): JSX.Element {
    const r = rng(seed);
    const status = r() < 0.25 ? 'Delayed' : flight.status;
    const progress = 8 + Math.floor(r() * 88);
    return (
        <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">{flight.callsign}</div>
                <div className="truncate text-[9px] text-white/35">{flight.route}</div>
            </div>
            <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-white/50"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="shrink-0 text-right text-[9px] text-white/45">{status}</div>
        </div>
    );
}

/** Three seeded rows of the mock board. */
export function Flightracker({ seed }: TileProps): JSX.Element {
    const first = Math.abs(seed) % MOCK_FLIGHTS.length;
    const rows = [0, 2, 4].map((step) => MOCK_FLIGHTS[(first + step) % MOCK_FLIGHTS.length]);

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Flights" tag="MOCK BOARD" />

            <div className="flex min-h-0 flex-1 flex-col justify-between py-1">
                {rows.map((flight, i) => (
                    <MockRow key={flight.callsign} seed={seed + i * 41 + 3} flight={flight} />
                ))}
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">LIVE</span>
                <span className="font-mono text-[10px] text-white/30">ADS-B</span>
            </div>
        </div>
    );
}

/** The flights of a live tile, capped the one way every layer caps them. */
function liveFlights(flights: string[] | undefined): string[] {
    return flights && flights.length > 0 ? flights.slice(0, MAX_FLIGHTS) : [];
}

/** Loads the live states of the utterance's flights over the chosen provider's channel. */
function useLiveFlights(args: CommandArgs, channel: IpcChannel): LiveLoader<FlightState[]> {
    const flights = liveFlights(args.flights);
    return {
        pending: false,
        notice: flights.length === 0 ? 'Name a flight first, like LH123.' : null,
        state: useProviderData<FlightState[]>(
            channel,
            flights.length > 0 ? flights.join(',') : null,
            [flights]
        )
    };
}

/** HH:MM UTC for an ISO time. */
function clockUtc(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'UTC'
    }).format(Date.parse(iso));
}

/** One row of live states: the flight asked for, its phase, altitude and speed. */
function FlightRow({
    flight,
    state
}: {
    flight: string;
    state: FlightState | undefined;
}): JSX.Element {
    const phase = state ? flightPhase(state) : 'no-position';
    return (
        <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">{flight}</div>
                <div className="truncate text-[9px] text-white/35">
                    {state
                        ? `${state.callsign} · seen ${clockUtc(state.lastSeen)} UTC`
                        : 'No live state'}
                </div>
            </div>
            <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.12em] uppercase ${PHASE_STYLE[phase]}`}
            >
                {PHASE_LABEL[phase]}
            </span>
            <div className="shrink-0 text-right font-mono text-[9px] text-white/60">
                {state ? (
                    <>
                        <div>{formatAltitude(state.altitudeM)}</div>
                        <div>{formatSpeed(state.speedKmh)}</div>
                    </>
                ) : (
                    <div>—</div>
                )}
            </div>
        </div>
    );
}

/** The live states of the flights the utterance named, over the provider channel. */
export function LiveFlightracker({
    args,
    data: states
}: LiveTileProps<FlightState[]>): JSX.Element {
    const flights = liveFlights(args.flights);
    return (
        <div className="flex min-h-0 flex-col justify-between gap-2 py-1">
            {flights.map((flight) => (
                <FlightRow
                    key={flight}
                    flight={flight}
                    state={states.find((state) => callsignMatches(state.callsign, flight))}
                />
            ))}
        </div>
    );
}

export const flightrackerTile: TileDefinition<FlightState[]> = {
    id: 'flightracker',
    title: 'Flights',
    Component: Flightracker,
    Live: LiveFlightracker,
    providers: [{ provider: OPEN_SKY, channel: IPC_CHANNELS.flightStates }],
    liveData: useLiveFlights,
    liveKey: ({ flights }) => `flightracker:${liveFlights(flights).join(',')}`,
    route: {
        description:
            'Live status and position of flights by flight number, like LH123: en route or on the ground, altitude and speed.',
        keywords: [
            'flight',
            'flights',
            'plane',
            'airline',
            'departures',
            'arrivals',
            'boarding',
            'landed',
            'track'
        ],
        examples: ['where is flight LH123', 'track flight BA456', 'has my flight landed'],
        pattern:
            /\b(?:flights?|planes?|airlines?|departures?|arrivals?|boarding|landed|en route)\b/,
        weight: 3,
        args: ({ flights }) => ({ flights })
    }
};

import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { IpcChannel } from '../../../shared/ipc';
import { OPEN_SKY } from '../../../shared/providers';
import {
    callsignCoreMatches,
    callsignMatches,
    flightPhase,
    formatAltitude,
    formatSpeed,
    legProgress
} from '../../../shared/flights';
import type { FlightState } from '../../../shared/flights';
import { MAX_FLIGHTS } from '../../../shared/flights';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { useProviderData } from '../../shell/kit/hooks';
import { pick, rng } from '../../shell/kit/seed';
import type {
    CommandArgs,
    LiveLoader,
    LiveTileProps,
    TileDefinition,
    TileProps
} from '../../shell/tile';

/** The seeded mock legs: a callsign and its route, shown on a resting cell. */
const MOCK_LEGS = [
    { callsign: 'FR4167', origin: 'BGY', destination: 'STN' },
    { callsign: 'LH123', origin: 'FRA', destination: 'JFK' },
    { callsign: 'BA456', origin: 'LHR', destination: 'CDG' },
    { callsign: 'UA900', origin: 'SFO', destination: 'DEN' },
    { callsign: 'AF1007', origin: 'CDG', destination: 'LIS' },
    { callsign: 'QF11', origin: 'SIN', destination: 'SYD' }
];

/** Seeded times for the mock card, so the resting tile needs no Date. */
const MOCK_DEPARTED = [
    '2026-11-05T11:04:00.000Z',
    '2026-11-05T06:40:00.000Z',
    '2026-11-05T18:22:00.000Z'
];
const MOCK_ARRIVALS = [
    '2026-11-05T14:13:00.000Z',
    '2026-11-05T19:55:00.000Z',
    '2026-11-05T21:02:00.000Z'
];

/** The phase colors, as literal hex values for the svg and the badge. */
const PHASE_COLOR: Record<string, string> = {
    'en-route': '#5eead4',
    'on-ground': '#fcd34d',
    'no-position': '#ffffff'
};

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

/** The arc of the card: start, control and end point in the 100x34 viewBox. */
const ARC = { x0: 6, y0: 28, cx: 50, cy: 2, x1: 94, y1: 28 };

/** The point on the arc at `t` and its tangent angle, for the plane glyph. */
function arcPoint(t: number): { x: number; y: number; angle: number } {
    const { x0, y0, cx, cy, x1, y1 } = ARC;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
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

/** The footer's left side: the leg's times when known, else the last-seen time. */
function whenLabel(state: FlightState): string {
    if (state.departureAt !== null && state.arrivalAt !== null) {
        return `Dep ${clockUtc(state.departureAt)} · Land ${clockUtc(state.arrivalAt)}`;
    }
    return `Seen ${clockUtc(state.lastSeen)} UTC`;
}

/** One flight card: callsign and phase, the arc from origin to destination, the numbers. */
function FlightCard({ state, progress }: { state: FlightState; progress: number }): JSX.Element {
    const phase = flightPhase(state);
    const color = PHASE_COLOR[phase];
    const at = arcPoint(Math.min(1, Math.max(0, progress)));
    return (
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 py-0.5">
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-white">
                    {state.callsign}
                </span>
                <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.12em] uppercase ${PHASE_STYLE[phase]}`}
                >
                    {PHASE_LABEL[phase]}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-sm font-semibold text-white/90">
                    {state.origin ?? '—'}
                </span>
                <svg
                    viewBox="0 0 100 34"
                    className="h-8 min-w-0 flex-1 text-white/25"
                    aria-hidden="true"
                >
                    <path
                        d={`M${ARC.x0} ${ARC.y0} Q ${ARC.cx} ${ARC.cy} ${ARC.x1} ${ARC.y1}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeDasharray="1.5 3"
                        strokeLinecap="round"
                    />
                    <g
                        transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${at.angle.toFixed(1)})`}
                    >
                        <path d="M4.5 0 L-4 -2.6 L-1.6 0 L-4 2.6 Z" fill={color} />
                    </g>
                </svg>
                <span className="w-10 shrink-0 text-right text-sm font-semibold text-white/90">
                    {state.destination ?? '—'}
                </span>
            </div>
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-white/40">
                <span className="truncate">{whenLabel(state)}</span>
                <span className="shrink-0">
                    {formatAltitude(state.altitudeM)} · {formatSpeed(state.speedKmh)}
                </span>
            </div>
        </div>
    );
}

/** One seeded mock card on a resting cell. */
export function Flightracker({ seed }: TileProps): JSX.Element {
    const r = rng(seed + 17);
    const leg = pick(seed, MOCK_LEGS);
    const state: FlightState = {
        icao24: 'mock',
        callsign: leg.callsign,
        latitude: null,
        longitude: null,
        altitudeM: 8000 + Math.floor(r() * 4000),
        speedKmh: 700 + Math.floor(r() * 200),
        onGround: r() < 0.2,
        lastSeen: pick(seed + 1, MOCK_DEPARTED),
        origin: leg.origin,
        destination: leg.destination,
        departureAt: pick(seed + 2, MOCK_DEPARTED),
        arrivalAt: pick(seed + 3, MOCK_ARRIVALS)
    };
    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Flights" tag="MOCK" />
            <FlightCard state={state} progress={0.15 + r() * 0.7} />
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

/** The live cards of the flights the utterance named, over the provider channel. */
export function LiveFlightracker({
    args,
    data: states
}: LiveTileProps<FlightState[]>): JSX.Element {
    const flights = liveFlights(args.flights);
    const now = Date.now();
    return (
        <div className="flex min-h-0 flex-col justify-between gap-2 py-1">
            {flights.map((flight) => {
                const state = states.find(
                    (candidate) =>
                        callsignMatches(candidate.callsign, flight) ||
                        callsignCoreMatches(candidate.callsign, flight)
                );
                return state ? (
                    <FlightCard key={flight} state={state} progress={legProgress(state, now)} />
                ) : (
                    <div key={flight} className="flex items-center gap-2.5">
                        <span className="text-[12px] font-medium text-white">{flight}</span>
                        <span className="text-[9px] text-white/35">No live state</span>
                        <span
                            className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.12em] uppercase ${PHASE_STYLE['no-position']}`}
                        >
                            {PHASE_LABEL['no-position']}
                        </span>
                    </div>
                );
            })}
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

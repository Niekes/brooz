import type { JSX } from 'react';
import type { CommandArgs } from '../tile';
import { routedTile } from './manifest';
import type { CommandMatch } from './parse';
import type { LocalModel } from './use-local-model';

/** Rules are trusted a little sooner than the model. */
const RULE_THRESHOLD = 0.62;
const MODEL_THRESHOLD = 0.7;

export function isLowConfidence(match: CommandMatch): boolean {
    return match.confidence < (match.source === 'model' ? MODEL_THRESHOLD : RULE_THRESHOLD);
}

function truncate(value: string, limit: number): string {
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** The args of a match in one line: "Rome · 25 min · “buy milk”". */
function summaryFor(args: CommandArgs): string {
    return [
        args.city,
        args.durationMinutes && `${args.durationMinutes} min`,
        args.when,
        args.symbols?.join(' · '),
        args.query && `“${truncate(args.query, 40)}”`,
        args.note && `“${truncate(args.note, 46)}”`
    ]
        .filter(Boolean)
        .join(' · ');
}

export function titleOf(widget: string): string {
    return routedTile(widget)!.title;
}

export function SearchIcon(): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-white/35"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
        </svg>
    );
}

export function Spinner(): JSX.Element {
    return (
        <span
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/70"
            aria-label="Routing"
        />
    );
}

/** Example utterances, shown while the field is empty. */
export function Chips({
    examples,
    onPick
}: {
    examples: readonly string[];
    onPick: (text: string) => void;
}): JSX.Element {
    return (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
            {examples.map((text) => (
                <button
                    key={text}
                    type="button"
                    onClick={() => onPick(text)}
                    className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] tracking-[0.08em] text-white/45 backdrop-blur-xl transition-colors hover:border-white/20 hover:text-white/75"
                >
                    {text}
                </button>
            ))}
        </div>
    );
}

function RowNumber({ index, active }: { index: number; active: boolean }): JSX.Element {
    return (
        <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[9px] ${
                active
                    ? 'border-white/25 bg-white/10 text-white/70'
                    : 'border-white/10 bg-white/[0.03] text-white/35'
            }`}
        >
            {String(index + 1).padStart(2, '0')}
        </span>
    );
}

function RowSource({ match }: { match: CommandMatch }): JSX.Element {
    const fromModel = match.source === 'model';
    return (
        <span className="flex shrink-0 items-center gap-2">
            <span
                className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.14em] uppercase ${
                    fromModel
                        ? 'border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#c4b5fd]'
                        : 'border-white/10 bg-white/5 text-white/40'
                }`}
            >
                {match.source}
            </span>
            <span className="w-7 text-right font-mono text-[9px] text-white/45">
                {Math.round(match.confidence * 100)}%
            </span>
        </span>
    );
}

function SuggestionRow({
    match,
    index,
    active,
    onHover,
    onPick
}: {
    match: CommandMatch;
    index: number;
    active: boolean;
    onHover: () => void;
    onPick: () => void;
}): JSX.Element {
    return (
        <button
            id={`command-option-${index}`}
            type="button"
            role="option"
            aria-selected={active}
            onMouseEnter={onHover}
            onClick={onPick}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
            }`}
        >
            <RowNumber index={index} active={active} />

            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] text-white/90">
                        {titleOf(match.widget)}
                    </span>
                    {index === 0 && isLowConfidence(match) ? (
                        <span className="shrink-0 rounded-full border border-[#fcd34d]/25 bg-[#fcd34d]/10 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.12em] text-[#fcd34d]/80 uppercase">
                            Low confidence
                        </span>
                    ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[9px] tracking-[0.08em] text-white/35 uppercase">
                    {summaryFor(match.args) || 'Open widget'}
                </span>
            </span>

            <RowSource match={match} />
        </button>
    );
}

/** The ranked tiles for the query, or why there are none yet. */
export function SuggestionList({
    query,
    suggestions,
    activeIndex,
    emptyText,
    onHover,
    onPick
}: {
    query: string;
    suggestions: CommandMatch[];
    activeIndex: number;
    emptyText: string;
    onHover: (index: number) => void;
    onPick: (match: CommandMatch) => void;
}): JSX.Element {
    return (
        <div
            id="command-suggestions"
            role="listbox"
            aria-label="Widget suggestions"
            className="mb-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0c11]/95 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
            {suggestions.length > 0 ? (
                <div className="max-h-[40vh] overflow-y-auto p-1.5">
                    {suggestions.map((match, index) => (
                        <SuggestionRow
                            key={`${match.widget}-${match.source}-${index}`}
                            match={match}
                            index={index}
                            active={index === activeIndex}
                            onHover={() => onHover(index)}
                            onPick={() => onPick(match)}
                        />
                    ))}
                </div>
            ) : (
                <div className="px-4 py-3 text-[11px] text-white/40">
                    {emptyText || `No widget matched “${truncate(query, 48)}”.`}
                </div>
            )}
        </div>
    );
}

const STATUS_DOT: Record<LocalModel['status'], string> = {
    idle: 'bg-white/20',
    loading: 'bg-[#fcd34d]',
    ready: 'bg-[#4ade80]',
    error: 'bg-[#fda4af]'
};

function statusLabel(model: LocalModel): string {
    switch (model.status) {
        case 'idle':
            return 'Rules only';
        case 'loading':
            return `Loading local model ${model.progress}%`;
        case 'ready':
            return `Local model · ${model.runtime!.device} · ${model.runtime!.dtype}`;
        case 'error':
            return 'Local model unavailable';
    }
}

/** The model status left, the hint right, and the download progress below. */
export function StatusLine({
    model,
    hint,
    warn
}: {
    model: LocalModel;
    hint: string;
    warn: boolean;
}): JSX.Element {
    return (
        <>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[model.status]}`}
                    />
                    <span className="truncate text-[8px] font-medium tracking-[0.16em] text-white/30 uppercase">
                        {statusLabel(model)}
                    </span>
                    {model.status === 'error' ? (
                        <button
                            type="button"
                            onClick={model.load}
                            className="shrink-0 rounded-full border border-[#fda4af]/25 bg-[#fda4af]/10 px-2 py-0.5 text-[8px] font-medium tracking-[0.14em] text-[#fda4af] uppercase transition-colors hover:bg-[#fda4af]/15"
                        >
                            Retry
                        </button>
                    ) : null}
                </span>

                <span
                    className={`min-w-0 truncate text-[8px] font-medium tracking-[0.14em] uppercase ${
                        warn ? 'text-[#fcd34d]/70' : 'text-white/25'
                    }`}
                >
                    {truncate(hint, 64)}
                </span>
            </div>

            {model.status === 'loading' ? (
                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full bg-[#7dd3fc] transition-[width] duration-300"
                        style={{ width: `${model.progress}%` }}
                    />
                </div>
            ) : null}
        </>
    );
}

import type { JSX } from 'react';
import type { CommandArgs } from '../tile';
import { routedTile } from './manifest';
import type { CommandMatch } from './parse';
import type { QuickAction } from './quick-actions';
import type { LocalModel } from './use-local-model';
import { settingsShortcut } from '../kit/shortcut';

/** Rules are trusted a little sooner than the model. */
const RULE_THRESHOLD = 0.62;
const MODEL_THRESHOLD = 0.7;

export function isLowConfidence(match: CommandMatch): boolean {
    return match.confidence < (match.source === 'model' ? MODEL_THRESHOLD : RULE_THRESHOLD);
}

/**
 * The model ranks, but a confident rule hit stays on top: the small model
 * misroutes one-word asks that a keyword settles for sure.
 */
export function mergeMatches(rules: CommandMatch[], model: CommandMatch[]): CommandMatch[] {
    const rule = rules[0];
    if (!rule || isLowConfidence(rule) || model[0]?.widget === rule.widget) {
        return model;
    }
    return [rule, ...model.filter((match) => match.widget !== rule.widget)].slice(0, 3);
}

function truncate(value: string, limit: number): string {
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** One kind of argument, named: "Flight LH123", "Symbols AAPL · TSLA". */
function named(one: string, values: readonly string[] | undefined): string | undefined {
    return values ? `${one}${values.length > 1 ? 's' : ''} ${values.join(' · ')}` : undefined;
}

/** The arguments of a match in one line: "City Rome", "Flights LH123 · BA456". */
function summaryFor(args: CommandArgs): string {
    return [
        named('City', args.city ? [args.city] : undefined),
        named('Symbol', args.symbols),
        named('Flight', args.flights)
    ]
        .filter(Boolean)
        .join(' · ');
}

function titleOf(widget: string): string {
    return routedTile(widget)!.title;
}

export function SearchIcon(): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4 shrink-0 text-white/35"
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
            className="size-3.5 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/70"
            aria-label="Routing"
        />
    );
}

/** The quick actions, shown while the field is empty; a pick hands over the utterance. */
export function QuickActions({
    actions,
    onPick
}: {
    actions: readonly QuickAction[];
    onPick: (utterance: string) => void;
}): JSX.Element {
    return (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
            {actions.map(({ label, utterance }, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => onPick(utterance)}
                    className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] tracking-[0.08em] text-white/45 backdrop-blur-xl transition-colors hover:border-white/20 hover:text-white/75"
                >
                    {label || utterance}
                </button>
            ))}
        </div>
    );
}

function RowNumber({ index, active }: { index: number; active: boolean }): JSX.Element {
    return (
        <span
            className={`grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-[9px] ${
                active
                    ? 'border-white/25 bg-white/10 text-white/70'
                    : 'border-white/10 bg-white/3 text-white/35'
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
                active ? 'bg-white/8' : 'hover:bg-white/4'
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
                    {summaryFor(match.args) || 'Open tile'}
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

/** The one thing to do about the model: enable it, or retry after an error. */
function ModelAction({
    model,
    onEnable
}: {
    model: LocalModel;
    onEnable: () => void;
}): JSX.Element | null {
    if (model.status === 'idle') {
        return (
            <button
                type="button"
                onClick={onEnable}
                className="shrink-0 rounded-full border border-[#7dd3fc]/25 bg-[#7dd3fc]/10 px-2 py-0.5 text-[8px] font-medium tracking-[0.14em] text-[#7dd3fc] uppercase transition-colors hover:bg-[#7dd3fc]/15"
            >
                Enable local model · 380 MB
            </button>
        );
    }
    if (model.status === 'error') {
        return (
            <button
                type="button"
                onClick={model.load}
                className="shrink-0 rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[8px] font-medium tracking-[0.14em] text-destructive uppercase transition-colors hover:bg-destructive/15"
            >
                Retry
            </button>
        );
    }
    return null;
}

/** The model status left, the hint right, and the download progress below. */
export function StatusLine({
    model,
    hint,
    warn,
    onEnable,
    onOpenSettings
}: {
    model: LocalModel;
    hint: string;
    warn: boolean;
    onEnable: () => void;
    onOpenSettings: () => void;
}): JSX.Element {
    return (
        <>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span
                        className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[model.status]}`}
                    />
                    <span className="truncate text-[8px] font-medium tracking-[0.16em] text-white/30 uppercase">
                        {statusLabel(model)}
                    </span>
                    <ModelAction model={model} onEnable={onEnable} />
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[8px] font-medium tracking-[0.14em] text-white/50 uppercase transition-colors hover:bg-white/10 hover:text-white"
                    >
                        Settings {settingsShortcut()}
                    </button>
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

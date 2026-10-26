import type { JSX, ReactNode } from 'react';
import type { MissingKeyReason, ProviderInfo, ProviderOutcome } from '../../../shared/providers';

export interface LiveFrameProps {
    label: string;
    meta?: string;
    lowConfidence?: boolean;
    children: ReactNode;
}

/**
 * The chrome of a live tile: a status line with the tile name, the place or
 * live marker, and the low-confidence warning the router attaches.
 */
export function LiveFrame({ label, meta, lowConfidence, children }: LiveFrameProps): JSX.Element {
    return (
        <div className="flex h-full w-full min-h-0 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-medium tracking-[0.18em] text-white/45 uppercase">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ade80]" />
                    <span className="truncate">{label}</span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5">
                    {lowConfidence ? (
                        <span className="rounded-full border border-[#fcd34d]/30 bg-[#fcd34d]/10 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.1em] text-[#fcd34d]/90 uppercase">
                            Low confidence
                        </span>
                    ) : null}
                    {meta ? (
                        <span className="max-w-[8rem] truncate text-[9px] tracking-[0.12em] text-white/30 uppercase">
                            {meta}
                        </span>
                    ) : null}
                </span>
            </div>

            <div className="min-h-0 flex-1">{children}</div>
        </div>
    );
}

export function LiveSkeleton(): JSX.Element {
    return (
        <div
            className="flex h-full animate-pulse flex-col justify-between"
            aria-label="Loading live data"
        >
            <div className="flex items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-8 w-24 rounded-lg bg-white/10" />
                    <div className="h-2 w-16 rounded-full bg-white/5" />
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/10" />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="h-10 rounded-xl bg-white/[0.05]" />
                <div className="h-10 rounded-xl bg-white/[0.05]" />
                <div className="h-10 rounded-xl bg-white/[0.05]" />
            </div>
        </div>
    );
}

export function LiveError({
    message,
    onRetry
}: {
    message: string | null;
    onRetry: () => void;
}): JSX.Element {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-[#fda4af]/30 bg-[#fda4af]/10 font-mono text-sm text-[#fda4af]">
                !
            </span>
            <p className="line-clamp-2 text-[10px] leading-snug text-white/60">
                {message ?? "I couldn't load that right now."}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[8px] font-medium tracking-[0.16em] text-white/70 uppercase transition-colors hover:bg-white/10 hover:text-white"
            >
                Retry
            </button>
        </div>
    );
}

export interface AsyncView<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    reload: () => void;
}

/**
 * The three states of a live tile that loads data: a skeleton while it
 * loads, the error with a retry, and the data once it is there.
 */
export function LiveData<T>({
    label,
    lowConfidence,
    pending,
    state,
    meta,
    children
}: {
    label: string;
    lowConfidence: boolean;
    pending: boolean;
    state: AsyncView<T>;
    meta: (data: T) => string;
    children: (data: T) => ReactNode;
}): JSX.Element {
    const { data, error, loading, reload } = state;
    if (pending || (loading && !data)) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <LiveSkeleton />
            </LiveFrame>
        );
    }
    if (error || !data) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <LiveError message={error} onRetry={reload} />
            </LiveFrame>
        );
    }
    return (
        <LiveFrame label={label} meta={meta(data)} lowConfidence={lowConfidence}>
            {children(data)}
        </LiveFrame>
    );
}

/** What a tile shows while its provider has no key: a pointer, not a form. */
function MissingKey({
    provider,
    reason
}: {
    provider: ProviderInfo;
    reason: MissingKeyReason;
}): JSX.Element {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-white/5 font-mono text-sm text-white/70">
                ?
            </span>
            <p className="line-clamp-3 text-[10px] leading-snug text-white/60">
                {reason === 'encryption-unavailable'
                    ? `This system offers no encrypted place for a ${provider.title} key.`
                    : `Needs a ${provider.title} API key.`}
            </p>
            <p className="text-[9px] tracking-[0.14em] text-white/35 uppercase">
                Ask for "settings"
            </p>
        </div>
    );
}

/**
 * The chrome of a live tile backed by a provider: the states of `LiveData`,
 * plus the state a tile without its provider's key renders. That state is
 * an invitation to the settings - a tile never takes a key itself
 * (`docs/adr/0001-provider-keys-never-reach-the-renderer.md`).
 */
export function ProviderData<T>({
    label,
    lowConfidence,
    provider,
    state,
    children
}: {
    label: string;
    lowConfidence: boolean;
    provider: ProviderInfo;
    state: AsyncView<ProviderOutcome<T>>;
    children: (data: T) => ReactNode;
}): JSX.Element {
    const { data: outcome, error, reload } = state;
    if (!outcome && error) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <LiveError message={error} onRetry={reload} />
            </LiveFrame>
        );
    }
    if (!outcome) {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <LiveSkeleton />
            </LiveFrame>
        );
    }
    if (outcome.status === 'missing-key') {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <MissingKey provider={provider} reason={outcome.reason} />
            </LiveFrame>
        );
    }
    if (outcome.status === 'provider-error') {
        return (
            <LiveFrame label={label} lowConfidence={lowConfidence}>
                <LiveError message={outcome.message} onRetry={reload} />
            </LiveFrame>
        );
    }
    return (
        <LiveFrame label={label} meta={provider.title} lowConfidence={lowConfidence}>
            {children(outcome.data)}
        </LiveFrame>
    );
}

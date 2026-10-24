import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, JSX, KeyboardEvent, RefObject } from 'react';
import { AppCard } from '../glass/app-card';
import type { SummonRequest } from '../tile';
import {
    hintFor,
    useAutoSummon,
    useFocusShortcut,
    useModelWarmup,
    useNotice,
    waitingText
} from './ask-hooks';
import {
    Chips,
    SearchIcon,
    Spinner,
    StatusLine,
    SuggestionList,
    isLowConfidence,
    titleOf
} from './command-parts';
import { routedTile } from './manifest';
import { parseCommand } from './parse';
import type { CommandMatch } from './parse';
import { useLocalModel } from './use-local-model';
import type { LocalModel } from './use-local-model';
import { useModelRouting } from './use-model-routing';
import type { ModelRouting } from './use-model-routing';

/** Example utterances for the empty field, one per tile with a live version. */
const EXAMPLES = [
    'weather',
    'forecast',
    'air-quality',
    'pomodoro',
    'sticky-note',
    'world-clock'
].map((id) => routedTile(id)!.route.examples[0]);

/** The ask field rides on the glass surface, tuned through its custom properties. */
const INPUT_CARD_STYLE = {
    '--app-card-pad': '12px',
    '--app-card-radius': '18px',
    '--app-card-bg': 'rgba(11,12,17,0.92)'
} as CSSProperties;

function AskField({
    inputRef,
    query,
    expanded,
    activeId,
    pending,
    onChange,
    onKeyDown
}: {
    inputRef: RefObject<HTMLInputElement | null>;
    query: string;
    expanded: boolean;
    activeId: string | undefined;
    pending: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}): JSX.Element {
    return (
        <AppCard className="relative" style={INPUT_CARD_STYLE}>
            <div className="flex items-center gap-3">
                <SearchIcon />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder="Ask your dashboard…"
                    aria-label="Ask your dashboard"
                    role="combobox"
                    aria-expanded={expanded}
                    aria-controls="command-suggestions"
                    aria-autocomplete="list"
                    aria-activedescendant={activeId}
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                />
                {pending ? <Spinner /> : null}
                <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/30 sm:block">
                    ⌘K
                </kbd>
            </div>
        </AppCard>
    );
}

interface AskBar {
    query: string;
    suggestions: CommandMatch[];
    activeIndex: number;
    active: CommandMatch | undefined;
    lowConfidence: boolean;
    model: LocalModel;
    routing: ModelRouting;
    inputRef: RefObject<HTMLInputElement | null>;
    setSelected: (index: number) => void;
    replaceQuery: (text: string) => void;
}

/**
 * The state of the bar. The rules answer immediately; once the local model
 * is ready, only the model decides.
 */
function useAskBar(
    onSummon: (request: SummonRequest) => void,
    suppress: RefObject<boolean>,
    last: RefObject<string | null>
): AskBar {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const model = useLocalModel();
    const routing = useModelRouting(query, model.status, model.route);
    const parsed = useMemo(() => parseCommand(query), [query]);
    useModelWarmup(model.status, model.load);
    useFocusShortcut(inputRef);

    const suggestions = model.status === 'ready' ? routing.matches : parsed.matches;
    const activeIndex = Math.min(selected, Math.max(suggestions.length - 1, 0));
    const active: CommandMatch | undefined = suggestions[activeIndex];
    useAutoSummon(query, active, suppress, last, onSummon);

    const { reset } = routing;
    const replaceQuery = useCallback(
        (text: string) => {
            setQuery(text);
            setSelected(0);
            reset();
        },
        [reset]
    );

    return {
        query,
        suggestions,
        activeIndex,
        active,
        lowConfidence: active !== undefined && isLowConfidence(active),
        model,
        routing,
        inputRef,
        setSelected,
        replaceQuery
    };
}

/** What the arrow keys, Enter and Escape do in the field. */
function keyActions(
    bar: AskBar,
    execute: (match: CommandMatch) => void
): Record<string, () => void> {
    const { query, suggestions, activeIndex, active, inputRef, setSelected, replaceQuery } = bar;
    const move = (step: number): void => {
        if (suggestions.length > 0) {
            setSelected((activeIndex + step + suggestions.length) % suggestions.length);
        }
    };
    return {
        ArrowDown: () => move(1),
        ArrowUp: () => move(-1),
        Enter: () => active && execute(active),
        Escape: () => (query ? replaceQuery('') : inputRef.current!.blur())
    };
}

/** What a pick, a chip, a keystroke and an edit do to the bar. */
function useAskActions(
    bar: AskBar,
    onSummon: (request: SummonRequest) => void,
    suppress: RefObject<boolean>,
    last: RefObject<string | null>
) {
    const [notice, setNotice] = useNotice();
    const { inputRef, replaceQuery } = bar;

    const execute = (match: CommandMatch): void => {
        last.current = null;
        onSummon({
            widget: match.widget,
            args: match.args,
            source: match.source,
            confidence: match.confidence,
            lowConfidence: isLowConfidence(match)
        });
        if (!routedTile(match.widget)!.Live) {
            setNotice(
                `${titleOf(match.widget)} is still demo data — its live source is not connected yet.`
            );
        }
        replaceQuery('');
        inputRef.current!.focus();
    };

    const keys = keyActions(bar, execute);

    return {
        notice,
        execute,
        pickExample: (text: string): void => {
            suppress.current = true;
            replaceQuery(text);
            inputRef.current!.focus();
        },
        onChange: (event: ChangeEvent<HTMLInputElement>): void => {
            suppress.current = false;
            replaceQuery(event.target.value);
        },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>): void => {
            const action = keys[event.key];
            if (action) {
                event.preventDefault();
                action();
            }
        }
    };
}

/**
 * The ask bar: one always-visible input that routes an English utterance
 * to a tile. The rules answer immediately; the local model warms up in the
 * background and, once ready, decides alone. A confident route summons its
 * tile after a short pause (auto-summon), Enter summons the selection with
 * everything the utterance said.
 */
export function CommandBar({
    onSummon
}: {
    onSummon: (request: SummonRequest) => void;
}): JSX.Element {
    /** Set when a chip filled the field: the person chose it, so Enter decides. */
    const suppressAutoRef = useRef(false);
    /** The tile the last auto-summon activated; repeats are skipped. */
    const autoWidgetRef = useRef<string | null>(null);
    const bar = useAskBar(onSummon, suppressAutoRef, autoWidgetRef);
    const actions = useAskActions(bar, onSummon, suppressAutoRef, autoWidgetRef);
    const { query, suggestions, activeIndex, active, lowConfidence, model, routing } = bar;
    const typing = query.trim().length > 0;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] px-4">
            <div className="pointer-events-auto mx-auto w-full max-w-2xl">
                {typing ? (
                    <SuggestionList
                        query={query}
                        suggestions={suggestions}
                        activeIndex={activeIndex}
                        emptyText={waitingText(model.status, routing.pending)}
                        onHover={bar.setSelected}
                        onPick={actions.execute}
                    />
                ) : (
                    <Chips examples={EXAMPLES} onPick={actions.pickExample} />
                )}

                <AskField
                    inputRef={bar.inputRef}
                    query={query}
                    expanded={suggestions.length > 0}
                    activeId={typing && active ? `command-option-${activeIndex}` : undefined}
                    pending={routing.pending}
                    onChange={actions.onChange}
                    onKeyDown={actions.onKeyDown}
                />

                <StatusLine
                    model={model}
                    hint={hintFor(actions.notice, lowConfidence, routing.failure)}
                    warn={Boolean(actions.notice) || lowConfidence}
                />
            </div>
        </div>
    );
}

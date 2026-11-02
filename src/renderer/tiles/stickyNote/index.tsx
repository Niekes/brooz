import { useDebounce, useTimeout } from 'ahooks';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Eyebrow } from '../../shell/kit/chrome';
import { LiveFrame } from '../../shell/kit/live';
import { useStoredValue } from '../../shell/kit/browser';
import { HUES, pick } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';

const QUOTES = [
    { text: 'Simplicity is the soul of efficiency.', by: 'Austin Freeman' },
    { text: 'Make it work, make it right, make it fast.', by: 'Kent Beck' },
    {
        text: 'Perfection is achieved when there is nothing left to take away.',
        by: 'A. de Saint-Exupéry'
    },
    { text: 'The best way out is always through.', by: 'Robert Frost' },
    { text: "What got you here won't get you there.", by: 'Marshall Goldsmith' },
    { text: 'Slow is smooth, smooth is fast.', by: 'Navy SEAL proverb' },
    { text: 'Stay hungry, stay foolish.', by: 'Whole Earth Catalog' },
    { text: 'Dance like nobody is watching.', by: 'Mark Twain' }
];

/** A full-bleed warm panel, the still visual anchor of the set. */
export function StickyNote({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const quote = pick(seed + 2, QUOTES);

    return (
        <>
            <div
                className="absolute inset-0"
                style={{ background: `${hue.hex}1a` }}
                aria-hidden="true"
            />
            <div className="relative flex size-full flex-col justify-between">
                <div className="flex items-start justify-between">
                    <Eyebrow>Note</Eyebrow>
                    <span
                        className="mt-1 size-1.5 rounded-full"
                        style={{ background: hue.hex }}
                        aria-hidden="true"
                    />
                </div>

                <p className="flex min-h-0 flex-1 items-center text-[15px] leading-relaxed text-white/85">
                    “{quote.text}”
                </p>

                <div className="font-mono text-[10px] tracking-widest text-white/45 uppercase">
                    — {quote.by}
                </div>
            </div>
        </>
    );
}

const STORAGE_KEY = 'brooz.note.v1';
const SAVE_DELAY = 350;
const SAVED_BADGE = 1600;

type SaveStatus = 'idle' | 'saving' | 'saved';

const META: Record<SaveStatus, string> = { idle: 'Local', saving: 'Saving', saved: 'Saved' };

/**
 * Builds before the storage hook stored the note as raw text, which the hook
 * cannot parse; rewrite it as JSON once, so no note is lost.
 */
export function migrateStoredNote(storage: Storage): void {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
        return;
    }
    try {
        if (typeof JSON.parse(raw) === 'string') {
            return;
        }
    } catch {
        // Raw text: rewritten below.
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

/** The note text, saved a moment after each edit, and where the saving is. */
function useSavedNote(initial: string | undefined): [string, SaveStatus, (value: string) => void] {
    const [stored, setStored] = useStoredValue(STORAGE_KEY, '');
    const [text, setText] = useState(() => initial ?? stored);
    const [status, setStatus] = useState<SaveStatus>('idle');
    const settled = useDebounce(text, { wait: SAVE_DELAY });

    useEffect(() => {
        setStored(settled);
        setStatus('saved');
    }, [settled, setStored]);

    useTimeout(() => setStatus('idle'), status === 'saved' ? SAVED_BADGE : undefined);

    const update = (value: string): void => {
        setText(value);
        setStatus('saving');
    };
    return [text, status, update];
}

/** A note that persists in this window's storage, prefilled by the utterance. */
export function LiveNote({ label, lowConfidence, args }: LiveTileProps): JSX.Element {
    const [text, status, update] = useSavedNote(args.note);

    return (
        <LiveFrame label={label} meta={META[status]} lowConfidence={lowConfidence}>
            <div className="flex h-full min-h-0 flex-col gap-1.5">
                <textarea
                    value={text}
                    onChange={(event) => update(event.target.value)}
                    placeholder="Write something down…"
                    aria-label="Sticky note"
                    className="min-h-0 w-full flex-1 resize-none rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-white/85 outline-none placeholder:text-white/25 focus:border-white/25"
                />

                <div className="flex items-center justify-between gap-2 text-[8px] tracking-widest text-white/30 uppercase">
                    <span>
                        {text.length} {text.length === 1 ? 'char' : 'chars'}
                    </span>
                    <button
                        type="button"
                        onClick={() => update('')}
                        disabled={!text}
                        className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[8px] font-medium tracking-[0.14em] text-white/45 uppercase transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </LiveFrame>
    );
}

export const stickyNoteTile: TileDefinition = {
    id: 'sticky-note',
    title: 'Sticky Note',
    Component: StickyNote,
    Live: LiveNote,
    liveKey: ({ note }) => `sticky-note:${note ?? ''}`,
    route: {
        description: 'Create or edit a short personal note or quick reminder.',
        keywords: ['note', 'remind', 'remember', 'write down'],
        examples: ['note: buy milk', 'write down call the dentist'],
        pattern: /\b(?:notes?|write down|remind|remember|jot down)\b/,
        weight: 3.5,
        args: ({ note }) => ({ note })
    }
};

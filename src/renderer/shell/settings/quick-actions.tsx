import { useState } from 'react';
import type { JSX } from 'react';
import { MAX_QUICK_ACTIONS, useQuickActions } from '../command/quick-actions';
import type { QuickAction } from '../command/quick-actions';
import { AppButton } from '../ui/app-button';
import { AppInput } from '../ui/app-input';

/**
 * One quick action, edited in place and saved when the field is left; an
 * emptied utterance is not saved, the field takes the saved one back.
 */
function QuickActionRow({
    index,
    action,
    onSave,
    onDelete
}: {
    index: number;
    action: QuickAction;
    onSave: (action: QuickAction) => void;
    onDelete: () => void;
}): JSX.Element {
    const [draft, setDraft] = useState(action);
    // The row keeps its place when it saves, so the focus stays in it; a changed
    // saved entry - its own save, or a delete above it - becomes the draft.
    const [saved, setSaved] = useState(action);
    if (saved.label !== action.label || saved.utterance !== action.utterance) {
        setSaved(action);
        setDraft(action);
    }
    const commit = (): void => {
        const next = { label: draft.label.trim(), utterance: draft.utterance.trim() };
        if (!next.utterance) {
            setDraft(action);
        } else if (next.label !== action.label || next.utterance !== action.utterance) {
            onSave(next);
        }
    };
    return (
        <li className="flex items-center gap-2">
            <AppInput
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                onBlur={commit}
                placeholder="Label (optional)"
                aria-label={`Label ${index + 1}`}
                className="w-40 shrink-0"
            />
            <AppInput
                value={draft.utterance}
                onChange={(event) => setDraft({ ...draft, utterance: event.target.value })}
                onBlur={commit}
                placeholder="Utterance"
                aria-label={`Utterance ${index + 1}`}
            />
            <AppButton onClick={onDelete} aria-label={`Delete quick action ${index + 1}`}>
                Delete
            </AppButton>
        </li>
    );
}

/** The fields that add a quick action: the label is optional, the utterance is not. */
function NewQuickAction({
    full,
    onAdd
}: {
    full: boolean;
    onAdd: (action: QuickAction) => void;
}): JSX.Element {
    const [label, setLabel] = useState('');
    const [utterance, setUtterance] = useState('');
    return (
        <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                onAdd({ label: label.trim(), utterance: utterance.trim() });
                setLabel('');
                setUtterance('');
            }}
        >
            <AppInput
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Label (optional)"
                aria-label="New label"
                className="w-40 shrink-0"
            />
            <AppInput
                value={utterance}
                onChange={(event) => setUtterance(event.target.value)}
                placeholder="Utterance, like track flight LH123"
                aria-label="New utterance"
            />
            <AppButton type="submit" disabled={full || utterance.trim().length === 0}>
                Add
            </AppButton>
        </form>
    );
}

/** The quick actions the ask bar offers, edited in their own settings section (docs/adr/0017). */
export function QuickActionsOption(): JSX.Element {
    const [actions, setActions] = useQuickActions();
    const replace = (index: number, action: QuickAction): void =>
        setActions(actions.map((current, at) => (at === index ? action : current)));
    return (
        <>
            <ul className="flex flex-col gap-2">
                {actions.map((action, index) => (
                    <QuickActionRow
                        key={index}
                        index={index}
                        action={action}
                        onSave={(saved) => replace(index, saved)}
                        onDelete={() => setActions(actions.filter((_, at) => at !== index))}
                    />
                ))}
            </ul>
            <NewQuickAction
                full={actions.length >= MAX_QUICK_ACTIONS}
                onAdd={(action) => setActions([...actions, action])}
            />
        </>
    );
}

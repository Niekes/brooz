import { useState } from 'react';
import type { JSX } from 'react';
import { MAX_QUICK_ACTIONS, isQuickAction, useQuickActions } from '../command/quick-actions';
import type { QuickAction } from '../command/quick-actions';
import { AppButton } from '../ui/app-button';
import { AppInput } from '../ui/app-input';

const EMPTY: QuickAction = { label: '', utterance: '' };

function trimmed({ label, utterance }: QuickAction): QuickAction {
    return { label: label.trim(), utterance: utterance.trim() };
}

/** The two inputs of a quick action, named for where they sit. */
function QuickActionFields({
    value,
    onChange,
    onBlur,
    labelName,
    utteranceName
}: {
    value: QuickAction;
    onChange: (value: QuickAction) => void;
    onBlur?: () => void;
    labelName: string;
    utteranceName: string;
}): JSX.Element {
    return (
        <>
            <AppInput
                value={value.label}
                onChange={(event) => onChange({ ...value, label: event.target.value })}
                onBlur={onBlur}
                placeholder="Label (optional)"
                aria-label={labelName}
                className="w-40 shrink-0"
            />
            <AppInput
                value={value.utterance}
                onChange={(event) => onChange({ ...value, utterance: event.target.value })}
                onBlur={onBlur}
                placeholder="Utterance, like track flight LH123"
                aria-label={utteranceName}
            />
        </>
    );
}

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
        const next = trimmed(draft);
        if (!isQuickAction(next)) {
            setDraft(action);
        } else if (next.label !== action.label || next.utterance !== action.utterance) {
            onSave(next);
        }
    };
    return (
        <li className="flex items-center gap-2">
            <QuickActionFields
                value={draft}
                onChange={setDraft}
                onBlur={commit}
                labelName={`Label ${index + 1}`}
                utteranceName={`Utterance ${index + 1}`}
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
    const [draft, setDraft] = useState(EMPTY);
    return (
        <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                onAdd(trimmed(draft));
                setDraft(EMPTY);
            }}
        >
            <QuickActionFields
                value={draft}
                onChange={setDraft}
                labelName="New label"
                utteranceName="New utterance"
            />
            <AppButton type="submit" disabled={full || !isQuickAction(draft)}>
                Add
            </AppButton>
        </form>
    );
}

/** The quick actions the ask bar offers, edited in their own settings section (docs/adr/0017). */
export function QuickActionsOption(): JSX.Element {
    const [actions, setActions] = useQuickActions();
    return (
        <>
            <ul className="flex flex-col gap-2">
                {actions.map((action, index) => (
                    <QuickActionRow
                        key={index}
                        index={index}
                        action={action}
                        onSave={(saved) =>
                            setActions(
                                actions.map((current, at) => (at === index ? saved : current))
                            )
                        }
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

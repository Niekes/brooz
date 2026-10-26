import { useState } from 'react';
import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { KeyStatus, ProviderInfo, ProviderProbe } from '../../../shared/providers';
import { errorMessage, useKeyStatus } from '../../shell/kit/hooks';

/**
 * One provider of the settings: the status of its key, and the controls
 * that manage it. A key crosses this component once, on its way from the
 * input to the `key-set` channel, and is never shown again.
 */

/** What a probe of a stored key tells its provider's row. */
function probeNotice(probe: ProviderProbe): string {
    switch (probe.status) {
        case 'ok':
            return 'The key works.';
        case 'missing-key':
            return 'There is no key to test.';
        default:
            return `The provider said: ${probe.message}`;
    }
}

/** What the row says about the state of its provider's key. */
function statusText(status: { loading: boolean; data: KeyStatus | null }): string {
    if (status.loading) {
        return 'Checking';
    }
    const state = status.data;
    if (state === null || state.canStore) {
        return state?.present ? 'Key stored' : 'No key';
    }
    return 'No keyring';
}

/** The one shape of the settings' buttons. */
function KeyButton({
    label,
    onClick,
    disabled
}: {
    label: string;
    onClick: () => void;
    disabled: boolean;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[8px] font-medium tracking-[0.16em] text-white/70 uppercase transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
            {label}
        </button>
    );
}

/** The input that takes a key, and the button that stores it. */
function KeyField({
    provider,
    busy,
    locked,
    run,
    onSaved
}: {
    provider: ProviderInfo;
    busy: boolean;
    locked: boolean;
    run: (action: () => Promise<void>) => Promise<void>;
    onSaved: (saved: boolean) => void;
}): JSX.Element {
    const [value, setValue] = useState('');
    return (
        <>
            <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`${provider.title} API key`}
                aria-label={`${provider.title} API key`}
                disabled={busy || locked}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
            />
            <KeyButton
                label="Save"
                disabled={busy || locked || value.trim().length === 0}
                onClick={() =>
                    run(async () => {
                        const result = await window.brooz.invoke(
                            IPC_CHANNELS.keySet,
                            provider.id,
                            value
                        );
                        setValue('');
                        onSaved(result.status === 'ok');
                    })
                }
            />
        </>
    );
}

/** The buttons of a stored key: check it against the service, or drop it. */
function StoredKeyActions({
    provider,
    busy,
    run,
    onNotice,
    onRemoved
}: {
    provider: ProviderInfo;
    busy: boolean;
    run: (action: () => Promise<void>) => Promise<void>;
    onNotice: (notice: string) => void;
    onRemoved: () => void;
}): JSX.Element {
    return (
        <>
            <KeyButton
                label="Test"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        const probe = await window.brooz.invoke(IPC_CHANNELS.keyTest, provider.id);
                        onNotice(probeNotice(probe));
                    })
                }
            />
            <KeyButton
                label="Delete"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        await window.brooz.invoke(IPC_CHANNELS.keyDelete, provider.id);
                        onRemoved();
                    })
                }
            />
        </>
    );
}

/** The provider's name, the state of its key, and where the key comes from. */
function RowHeader({
    provider,
    status,
    locked
}: {
    provider: ProviderInfo;
    status: { loading: boolean; data: KeyStatus | null };
    locked: boolean;
}): JSX.Element {
    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-white">
                    {provider.title}
                </span>
                <span className="shrink-0 text-[9px] tracking-[0.12em] text-white/40 uppercase">
                    {statusText(status)}
                </span>
            </div>
            <p className="text-[9px] leading-snug text-white/40">
                {locked
                    ? 'This system offers no encrypted place for keys, so none can be stored here.'
                    : `${provider.description} Key at ${provider.keyUrl}.`}
            </p>
        </>
    );
}

/** One provider of the settings: its status line and the controls around it. */
export function ProviderRow({ provider }: { provider: ProviderInfo }): JSX.Element {
    const status = useKeyStatus(provider);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function run(action: () => Promise<void>): Promise<void> {
        setBusy(true);
        setNotice(null);
        try {
            await action();
        } catch (cause) {
            setNotice(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }

    const state = status.data;
    const locked = state !== null && !state.canStore;

    return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <RowHeader provider={provider} status={status} locked={locked} />
            <div className="flex items-center gap-1.5">
                <KeyField
                    provider={provider}
                    busy={busy}
                    locked={locked}
                    run={run}
                    onSaved={(saved) => {
                        setNotice(
                            saved ? 'Key saved.' : 'This system offers no encrypted place for keys.'
                        );
                        if (saved) {
                            status.reload();
                        }
                    }}
                />
                {state?.present ? (
                    <StoredKeyActions
                        provider={provider}
                        busy={busy}
                        run={run}
                        onNotice={setNotice}
                        onRemoved={() => {
                            setNotice('Key removed.');
                            status.reload();
                        }}
                    />
                ) : null}
            </div>
            {notice !== null ? <p className="text-[9px] text-white/50">{notice}</p> : null}
        </div>
    );
}

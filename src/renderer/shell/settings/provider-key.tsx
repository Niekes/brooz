import { useState } from 'react';
import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { KeyStatus, ProviderInfo, ProviderProbe } from '../../../shared/providers';
import { errorMessage, useKeyStatus } from '../kit/hooks';
import { AppBadge } from '../ui/app-badge';
import { AppButton } from '../ui/app-button';
import { AppInput } from '../ui/app-input';

/**
 * A provider's key in a settings section: its status, and the controls that
 * manage it. A key crosses this component once, on its way from the input
 * to the `key-set` channel, and is never shown again. Every section of a
 * provider shows the same key.
 */

/** What a probe of a stored key tells its provider's section. */
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

/** What the badge says about the state of the provider's key. */
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
            <AppInput
                type="password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`${provider.title} API key`}
                aria-label={`${provider.title} API key`}
                disabled={busy || locked}
                className="font-mono"
            />
            <AppButton
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
            >
                Save
            </AppButton>
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
            <AppButton
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        const probe = await window.brooz.invoke(IPC_CHANNELS.keyTest, provider.id);
                        onNotice(probeNotice(probe));
                    })
                }
            >
                Test
            </AppButton>
            <AppButton
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        await window.brooz.invoke(IPC_CHANNELS.keyDelete, provider.id);
                        onRemoved();
                    })
                }
            >
                Delete
            </AppButton>
        </>
    );
}

/** The key's name and status, and where a key comes from. */
function KeyHeader({
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
                <span className="truncate text-sm font-medium">{provider.title} API key</span>
                <AppBadge>{statusText(status)}</AppBadge>
            </div>
            <p className="text-xs text-white/45">
                {locked
                    ? 'This system offers no encrypted place for keys, so none can be stored here.'
                    : `${provider.description} Get a key at ${provider.keyUrl}. One key serves every tile of ${provider.title}.`}
            </p>
        </>
    );
}

/** One provider's key: its status, where it comes from, and its controls. */
export function ProviderKey({ provider }: { provider: ProviderInfo }): JSX.Element {
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
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/3 p-4">
            <KeyHeader provider={provider} status={status} locked={locked} />
            <div className="flex items-center gap-2">
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
            {notice !== null ? (
                <p role="status" className="text-xs text-white/60">
                    {notice}
                </p>
            ) : null}
        </div>
    );
}

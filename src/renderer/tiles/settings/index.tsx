import type { JSX } from 'react';
import { PROVIDERS } from '../../../shared/providers';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { LiveFrame } from '../../shell/kit/live';
import { pick } from '../../shell/kit/seed';
import type { LiveTileProps, TileDefinition, TileProps } from '../../shell/tile';
import { ProviderRow } from './provider-row';

/**
 * The settings: the one surface that manages keys. It talks to the key
 * channels - write-only, like every key channel - and never shows a key.
 */

/** What the resting tile says about the settings, seeded so the pattern varies. */
const HINTS = [
    'Add an API key to make the markets live',
    'Keys stay encrypted in the OS keychain',
    'One key per provider, every tile may use it'
];

/** The resting settings: the providers of the dashboard, and where their keys come from. */
export function Settings({ seed }: TileProps): JSX.Element {
    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Settings" tag="API KEYS" />

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
                {PROVIDERS.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium text-white">
                                {provider.title}
                            </div>
                            <div className="truncate text-[9px] text-white/35">
                                {provider.keyUrl}
                            </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.1em] text-white/50 uppercase">
                            Key
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex items-end justify-between gap-2">
                <span className="truncate text-[10px] text-white/40">{pick(seed, HINTS)}</span>
                <span className="shrink-0 font-mono text-[10px] text-white/30">ASK “SETTINGS”</span>
            </div>
        </div>
    );
}

/** The live settings: one row per provider, ready to take or drop a key. */
export function LiveSettings({ label, lowConfidence }: LiveTileProps): JSX.Element {
    return (
        <LiveFrame label={label} lowConfidence={lowConfidence}>
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
                {PROVIDERS.map((provider) => (
                    <ProviderRow key={provider.id} provider={provider} />
                ))}
            </div>
        </LiveFrame>
    );
}

export const settingsTile: TileDefinition = {
    id: 'settings',
    title: 'Settings',
    Component: Settings,
    Live: LiveSettings,
    liveKey: () => 'settings',
    route: {
        description: 'Managing the API keys of the data providers and app settings.',
        keywords: ['settings', 'keys', 'api key', 'provider'],
        examples: ['open the settings', 'add an api key'],
        pattern: /\b(?:settings?|keys?|provider)\b/,
        weight: 3
    }
};

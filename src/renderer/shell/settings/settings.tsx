import { useEventListener } from 'ahooks';
import { useState } from 'react';
import type { JSX } from 'react';
import { PROVIDERS } from '../../../shared/providers';
import type { ProviderId, ProviderInfo } from '../../../shared/providers';
import { tiles } from '../../tiles';
import type { TileDefinition } from '../tile';
import { ProviderIcon } from '../kit/icons';
import { isSettingsShortcut } from '../kit/shortcut';
import { AppDialog } from '../ui/app-dialog';
import { AppInput } from '../ui/app-input';
import { AppSeparator } from '../ui/app-separator';
import { DefaultLocationOption, SurfSpotOption } from './default-location';
import { ProviderKey } from './provider-key';
import { useDeviceLocationSetting, useTemperatureUnit } from '../kit/hooks';

/**
 * The settings: the one surface that manages keys and options, shown over the
 * dashboard. A sidebar lists the general section first - the choices that
 * belong to the person: the device location switch, the default location and
 * the temperature unit - then, under a separator, one section per provider of
 * the manifest, in manifest order, each with its mark, the tiles it serves and
 * its key. A key is one per provider and shows once, no matter how many tiles
 * it serves; a tile option that belongs to a keyed tile (today the surf spot)
 * lives in that provider's section.
 */

/** A sidebar entry: the words the search finds it by, and what it shows. */
interface Section {
    id: string;
    title: string;
    /** The provider's mark, in the nav and the heading; General has none. */
    icon?: ProviderId;
    /** One line under the heading, naming what the section serves. */
    subtitle?: string;
    terms: string[];
    Body: () => JSX.Element;
}

/** Whether a section matches the search, by any of its terms. */
function matches(section: Section, search: string): boolean {
    return section.terms.some((term) => term.toLowerCase().includes(search));
}

/** Whether a tile's live data comes from this provider. */
function serves(provider: ProviderInfo, tile: TileDefinition): boolean {
    return tile.providers?.some((p) => p.id === provider.id) ?? false;
}

/** One sidebar section for a provider: its key, and the spot when a served tile has one. */
function providerSection(provider: ProviderInfo, served: string[]): Section {
    const hasSurfSpot = tiles.some((tile) => tile.surfSpot === true && serves(provider, tile));
    return {
        id: provider.id,
        title: provider.title,
        icon: provider.id,
        subtitle: `Serves ${served.join(' and ')}`,
        terms: [provider.title, ...served, ...(hasSurfSpot ? ['Surf spot'] : [])],
        Body: () => (
            <>
                <ProviderKey provider={provider} />
                {hasSurfSpot ? <SurfSpotOption /> : null}
            </>
        )
    };
}

/** Toggles the settings on ⌘, (Ctrl+, on Windows and Linux). */
export function useSettingsShortcut(toggle: () => void): void {
    useEventListener('keydown', (event: KeyboardEvent) => {
        if (isSettingsShortcut(event)) {
            event.preventDefault();
            toggle();
        }
    });
}

/** One nav row: the section's mark and title. */
function NavItem({
    section,
    current,
    onSelect
}: {
    section: Section;
    current: Section | undefined;
    onSelect: (id: string) => void;
}): JSX.Element {
    return (
        <li>
            <button
                type="button"
                aria-current={section === current ? 'page' : undefined}
                onClick={() => onSelect(section.id)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white"
            >
                {section.icon ? (
                    <ProviderIcon id={section.icon} className="size-4 shrink-0" />
                ) : null}
                {section.title}
            </button>
        </li>
    );
}

/** The sidebar: the search, the general section, then the providers under a separator. */
function SectionNav({
    search,
    onSearch,
    visible,
    current,
    onSelect
}: {
    search: string;
    onSearch: (search: string) => void;
    visible: Section[];
    current: Section | undefined;
    onSelect: (id: string) => void;
}): JSX.Element {
    const general = visible.filter((section) => section.id === 'general');
    const providers = visible.filter((section) => section.id !== 'general');
    // A separator with nothing above it means nothing, so it needs both groups.
    const showDivider = general.length > 0 && providers.length > 0;
    return (
        <nav
            aria-label="Settings sections"
            className="flex w-56 shrink-0 flex-col gap-3 border-r border-white/10 bg-white/2 p-3"
        >
            <AppInput
                type="search"
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ul className="flex flex-col gap-0.5">
                    {general.map((section) => (
                        <NavItem
                            key={section.id}
                            section={section}
                            current={current}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
                {showDivider ? (
                    <>
                        <AppSeparator className="my-2" />
                        <p className="px-2.5 pb-1 text-xs text-white/40">Provider keys</p>
                    </>
                ) : null}
                <ul className="flex flex-col gap-0.5">
                    {providers.map((section) => (
                        <NavItem
                            key={section.id}
                            section={section}
                            current={current}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
                {visible.length === 0 ? (
                    <p className="px-2.5 py-1.5 text-xs text-white/40">No setting matches.</p>
                ) : null}
            </div>
        </nav>
    );
}

/** One switch for every tile that follows the device location. */
function DeviceLocationOption(): JSX.Element {
    const [on, setOn] = useDeviceLocationSetting();
    return (
        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/2 p-4 text-sm">
            <input
                type="checkbox"
                checked={on}
                onChange={(event) => setOn(event.target.checked)}
                className="mt-0.5 accent-white"
            />
            <span className="flex flex-col gap-1">
                <span className="text-white">Use device location</span>
                <span className="text-xs text-white/50">
                    Without a city, the tile shows where this device is. Off, or without one, it
                    shows the default location. macOS may still deny the location in System Settings
                    › Privacy &amp; Security › Location Services.
                </span>
            </span>
        </label>
    );
}

const UNITS = [
    { unit: 'C', label: 'Celsius' },
    { unit: 'F', label: 'Fahrenheit' }
] as const;

/** One temperature unit for every tile that shows temperatures. */
function TemperatureUnitOption(): JSX.Element {
    const [current, setUnit] = useTemperatureUnit();
    return (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/2 p-4 text-sm">
            <legend className="px-1 text-white">Temperature unit</legend>
            {UNITS.map(({ unit, label }) => (
                <label key={unit} className="flex items-center gap-3 text-white/80">
                    <input
                        type="radio"
                        name="temperature-unit"
                        checked={current === unit}
                        onChange={() => setUnit(unit)}
                        className="accent-white"
                    />
                    {label}
                </label>
            ))}
        </fieldset>
    );
}

const GENERAL: Section = {
    id: 'general',
    title: 'General',
    terms: ['General', 'Use device location', 'Default location', 'Temperature unit'].concat(
        UNITS.map(({ label }) => label)
    ),
    Body: () => (
        <>
            <DeviceLocationOption />
            <DefaultLocationOption />
            <TemperatureUnitOption />
        </>
    )
};

const SECTIONS: Section[] = [
    GENERAL,
    ...PROVIDERS.map((provider) => ({
        provider,
        served: tiles.filter((tile) => serves(provider, tile)).map((tile) => tile.title)
    }))
        // A provider that serves no tile has no section to put its key in.
        .filter(({ served }) => served.length > 0)
        .map(({ provider, served }) => providerSection(provider, served))
];

export function Settings({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}): JSX.Element {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(SECTIONS[0].id);
    const visible = SECTIONS.filter((section) => matches(section, search.trim().toLowerCase()));
    const current = visible.find((section) => section.id === selected) ?? visible[0];

    return (
        <AppDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Settings"
            description="Your general options, and the keys of the providers."
        >
            <SectionNav
                search={search}
                onSearch={setSearch}
                visible={visible}
                current={current}
                onSelect={setSelected}
            />
            <div className="min-w-0 flex-1 overflow-y-auto">
                {current ? (
                    <section aria-label={current.title} className="flex flex-col gap-4 p-8">
                        <div className="flex flex-col gap-1">
                            <h2 className="flex items-center gap-2.5 text-xl font-medium">
                                {current.icon ? (
                                    <ProviderIcon id={current.icon} className="size-6" />
                                ) : null}
                                {current.title}
                            </h2>
                            {current.subtitle ? (
                                <p className="text-sm text-white/50">{current.subtitle}</p>
                            ) : null}
                        </div>
                        <current.Body />
                    </section>
                ) : null}
            </div>
        </AppDialog>
    );
}

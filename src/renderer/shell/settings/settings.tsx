import { useEventListener } from 'ahooks';
import { useState } from 'react';
import type { JSX } from 'react';
import { tiles } from '../../tiles';
import type { TileDefinition } from '../tile';
import { isSettingsShortcut } from '../kit/shortcut';
import { AppDialog } from '../ui/app-dialog';
import { AppInput } from '../ui/app-input';
import { DefaultLocationOption } from './default-location';
import { ProviderKey } from './provider-key';
import { useDeviceLocationSetting, useTemperatureUnit } from '../kit/hooks';

/**
 * The settings: the one surface that manages keys, shown over the dashboard.
 * A sidebar lists one section per tile that has something to set, in grid
 * order; a section shows the keys of the tile's providers, and the device
 * location switch and the default location of a tile that follows it, and the
 * temperature unit of a tile that shows temperatures. A key shared by
 * several tiles shows in each of their sections and is still one key.
 */

/** A tile with providers: the settings give it a section. */
type ConfigurableTile = TileDefinition & Required<Pick<TileDefinition, 'providers'>>;

const SECTIONS = tiles.filter((tile): tile is ConfigurableTile => tile.providers !== undefined);

/** Whether a section matches the search, by tile title or provider name. */
function matches(tile: ConfigurableTile, search: string): boolean {
    const names = [tile.title, ...tile.providers.map((provider) => provider.title)];
    return names.some((name) => name.toLowerCase().includes(search));
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

/** The sidebar: the search, and the sections that match it. */
function SectionNav({
    search,
    onSearch,
    visible,
    current,
    onSelect
}: {
    search: string;
    onSearch: (search: string) => void;
    visible: ConfigurableTile[];
    current: ConfigurableTile | undefined;
    onSelect: (id: string) => void;
}): JSX.Element {
    return (
        <nav
            aria-label="Settings sections"
            className="flex w-56 shrink-0 flex-col gap-3 border-r border-white/10 bg-white/[0.02] p-3"
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
                    {visible.map((tile) => (
                        <li key={tile.id}>
                            <button
                                type="button"
                                aria-current={tile === current ? 'page' : undefined}
                                onClick={() => onSelect(tile.id)}
                                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white"
                            >
                                {tile.title}
                            </button>
                        </li>
                    ))}
                </ul>
                {visible.length === 0 ? (
                    <p className="px-2.5 py-1.5 text-xs text-white/40">No setting matches.</p>
                ) : null}
            </div>
        </nav>
    );
}

/** One switch for every tile that follows the device location, like a shared key. */
function DeviceLocationOption(): JSX.Element {
    const [on, setOn] = useDeviceLocationSetting();
    return (
        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
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

/** One temperature unit for every tile that shows temperatures, like the device location. */
function TemperatureUnitOption(): JSX.Element {
    const [current, setUnit] = useTemperatureUnit();
    return (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
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

export function Settings({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}): JSX.Element {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(SECTIONS[0].id);
    const visible = SECTIONS.filter((tile) => matches(tile, search.trim().toLowerCase()));
    const current = visible.find((tile) => tile.id === selected) ?? visible[0];

    return (
        <AppDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Settings"
            description="The keys and options of the tiles."
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
                        <h2 className="text-xl font-medium">{current.title}</h2>
                        {current.providers.map((provider) => (
                            <ProviderKey key={provider.id} provider={provider} />
                        ))}
                        {current.deviceLocation ? (
                            <>
                                <DeviceLocationOption />
                                <DefaultLocationOption />
                            </>
                        ) : null}
                        {current.temperatures ? <TemperatureUnitOption /> : null}
                    </section>
                ) : null}
            </div>
        </AppDialog>
    );
}

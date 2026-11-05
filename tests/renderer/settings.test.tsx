import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { FINNHUB, OPENWEATHERMAP } from '../../src/shared/providers';
import { TileProviderChoice } from '../../src/renderer/shell/settings/provider-choice';
import { ProviderKey } from '../../src/renderer/shell/settings/provider-key';
import {
    Settings,
    tileTerms,
    useSettingsShortcut
} from '../../src/renderer/shell/settings/settings';
import type { TileDefinition } from '../../src/renderer/shell/tile';
import { PLACE, stubBrooz } from './stubs';

describe('the settings', () => {
    // A test that fails early must not leave its stored setting to the next one.
    afterEach(() => localStorage.clear());

    const status = () =>
        stubBrooz({ 'brooz:key-status': () => ({ present: false, canStore: true }) });

    it('opens on general, then quick actions, every tile, and a marked section for every provider', async () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const nav = screen.getByRole('navigation', { name: 'Settings sections' });
        const buttons = within(nav).getAllByRole('button');
        expect(buttons.map((button) => button.textContent)).toEqual([
            'General',
            'Quick actions',
            'Weather',
            'Air Quality',
            'Markets',
            'Surf',
            'Flights',
            'About',
            'OpenWeatherMap',
            'Finnhub',
            'Stormglass',
            'OpenSky Network'
        ]);
        expect(
            buttons.map((button) => button.querySelector('[data-icon]')?.getAttribute('data-icon'))
        ).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'openweathermap',
            'finnhub',
            'stormglass',
            'opensky'
        ]);
        expect(within(nav).getByText('Tiles')).toBeTruthy();
        expect(within(nav).getByText('Provider keys')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'OpenWeatherMap' }));
        expect(await screen.findByText('No key')).toBeTruthy();
        expect(screen.getByLabelText('OpenWeatherMap API key')).toBeTruthy();
        expect(screen.getByText('Serves Weather and Air Quality')).toBeTruthy();
        const heading = screen.getByRole('heading', { name: 'OpenWeatherMap' });
        expect(heading.querySelector('[data-icon="openweathermap"]')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'OpenSky Network' }));
        expect(await screen.findByLabelText('OpenSky Network API key')).toBeTruthy();
        expect(screen.getByText('Serves Flights')).toBeTruthy();
        expect(
            screen
                .getByRole('heading', { name: 'OpenSky Network' })
                .querySelector('[data-icon="opensky"]')
        ).toBeTruthy();
    });

    it('picks the start tile in the general section, About by default', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const about = screen.getByRole('radio', { name: 'About' }) as HTMLInputElement;
        expect(about.checked).toBe(true);
        expect(localStorage.getItem('brooz.start.tile')).toBe(null);
        fireEvent.click(screen.getByRole('radio', { name: 'Weather' }));
        expect(localStorage.getItem('brooz.start.tile')).toBe('"weather"');
        expect(about.checked).toBe(false);
    });

    it("shows a tile location in a place tile's own section", () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
        expect(screen.getByLabelText('City of the Weather location')).toBeTruthy();
        expect(screen.getByText('Weather location')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Air Quality' }));
        expect(screen.getByLabelText('City of the Air Quality location')).toBeTruthy();
    });

    it("shows the surf spot in the surf tile's section, and nothing for About", () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Surf' }));
        expect(screen.getByLabelText('Town of the surf spot')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'About' }));
        expect(screen.getByText('No settings for this tile.')).toBeTruthy();
    });

    it('finds a surf spot by town, then moves it by its coordinates', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:geocode': () => ({ ...PLACE, name: 'Ericeira', latitude: 38.96 })
        });
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Surf' }));
        fireEvent.change(screen.getByLabelText('Town of the surf spot'), {
            target: { value: 'Ericeira' }
        });
        fireEvent.click(
            within(screen.getByRole('group', { name: 'Surf spot' })).getByRole('button', {
                name: 'Save'
            })
        );
        const field = (await screen.findByLabelText('Coordinates')) as HTMLInputElement;
        expect(field.value).toBe('38.96, 12.5');
        const stored = () => JSON.parse(localStorage.getItem('brooz.surf.spot')!);

        fireEvent.change(field, { target: { value: ' 38.99 , -9.42 ' } });
        fireEvent.blur(field);
        expect(stored()).toMatchObject({ name: 'Ericeira', latitude: 38.99, longitude: -9.42 });

        for (const wrong of ['91, 0', '0, 181', 'Ericeira', '']) {
            const moved = screen.getByLabelText('Coordinates') as HTMLInputElement;
            fireEvent.change(moved, { target: { value: wrong } });
            fireEvent.blur(moved);
            expect(moved.value).toBe('38.99, -9.42');
        }
        expect(stored()).toMatchObject({ latitude: 38.99, longitude: -9.42 });
    });

    it('turns the device location off and on in the general section, and nowhere else', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const option = screen.getByLabelText(/Use device location/) as HTMLInputElement;
        expect(option.checked).toBe(true);
        fireEvent.click(option);
        expect(option.checked).toBe(false);
        expect(localStorage.getItem('brooz.location.enabled')).toBe('false');
        fireEvent.click(screen.getByRole('button', { name: 'OpenWeatherMap' }));
        expect(screen.queryByLabelText(/Use device location/)).toBe(null);
        expect(screen.queryByLabelText('City of the default location')).toBe(null);
    });

    it('switches the temperature unit in the general section, and nowhere else', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        expect((screen.getByLabelText('Celsius') as HTMLInputElement).checked).toBe(true);
        fireEvent.click(screen.getByLabelText('Fahrenheit'));
        expect(localStorage.getItem('brooz.temperature.unit')).toBe('"F"');
        fireEvent.click(screen.getByRole('button', { name: 'OpenWeatherMap' }));
        expect(screen.queryByLabelText('Celsius')).toBe(null);
    });

    it('reads an unknown stored unit as Celsius', () => {
        localStorage.setItem('brooz.temperature.unit', '"K"');
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        expect((screen.getByLabelText('Celsius') as HTMLInputElement).checked).toBe(true);
    });

    it('looks a default location up, saves the place it found, and changes or clears it', async () => {
        localStorage.clear();
        const invoke = stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:geocode': () => ({ ...PLACE, country: 'Italy' })
        });
        render(<Settings open onOpenChange={vi.fn()} />);
        const input = screen.getByLabelText('City of the default location');
        const save = () =>
            within(screen.getByRole('group', { name: 'Default location' })).getByRole('button', {
                name: 'Save'
            });
        expect((save() as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(input, { target: { value: ' rome ' } });
        fireEvent.click(save());
        expect(await screen.findByText('Rome, Italy')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:geocode', 'rome');
        expect(JSON.parse(localStorage.getItem('brooz.location.default')!)).toMatchObject({
            name: 'Rome',
            latitude: 41.9
        });

        fireEvent.click(screen.getByRole('button', { name: 'Change' }));
        expect(
            (screen.getByLabelText('City of the default location') as HTMLInputElement).value
        ).toBe('');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByText('Rome, Italy')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(screen.getByLabelText('City of the default location')).toBeTruthy();
        expect(JSON.parse(localStorage.getItem('brooz.location.default') ?? 'null')).toBe(null);
        localStorage.clear();
    });

    it('names a saved place without a country by its name alone', () => {
        localStorage.setItem('brooz.location.default', JSON.stringify(PLACE));
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        expect(
            within(screen.getByRole('group', { name: 'Default location' })).getByText('Rome')
        ).toBeTruthy();
        localStorage.clear();
    });

    it('saves no default location when the lookup finds no place', async () => {
        localStorage.clear();
        stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:geocode': () => Promise.reject(new Error('No place found for "Atlantis".'))
        });
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('City of the default location'), {
            target: { value: 'Atlantis' }
        });
        fireEvent.click(
            within(screen.getByRole('group', { name: 'Default location' })).getByRole('button', {
                name: 'Save'
            })
        );
        expect(await screen.findByText('No place found for "Atlantis".')).toBeTruthy();
        expect(JSON.parse(localStorage.getItem('brooz.location.default') ?? 'null')).toBe(null);
    });

    it('opens the section a person picks', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Finnhub' }));
        expect(screen.getByRole('heading', { name: 'Finnhub' })).toBeTruthy();
        expect(screen.getByLabelText('Finnhub API key')).toBeTruthy();
        expect(screen.getByText('Serves Markets')).toBeTruthy();
    });

    it('filters the sections by tile, provider and the general options', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const search = screen.getByLabelText('Search settings');
        fireEvent.change(search, { target: { value: 'finn' } });
        expect(screen.getByRole('heading', { name: 'Finnhub' })).toBeTruthy();
        // Only one group matches, so the separators and their labels go too.
        expect(screen.queryByText('Provider keys')).toBe(null);
        expect(screen.queryByText('Tiles')).toBe(null);
        fireEvent.change(search, { target: { value: 'openweather' } });
        expect(screen.getByRole('heading', { name: 'OpenWeatherMap' })).toBeTruthy();
        fireEvent.change(search, { target: { value: 'surf spot' } });
        expect(screen.getByRole('heading', { name: 'Surf' })).toBeTruthy();
        fireEvent.change(search, { target: { value: 'Fahrenheit' } });
        expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
        expect(screen.queryByText('Provider keys')).toBe(null);
        fireEvent.change(search, { target: { value: 'location' } });
        expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
        fireEvent.change(search, { target: { value: 'nothing like it' } });
        expect(screen.getByText('No setting matches.')).toBeTruthy();
        expect(screen.queryByRole('region')).toBe(null);
        fireEvent.change(search, { target: { value: '' } });
        expect(screen.getByText('Provider keys')).toBeTruthy();
    });

    it('renders nothing while it is closed', () => {
        render(<Settings open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('closes on Esc', () => {
        status();
        const onOpenChange = vi.fn();
        render(<Settings open onOpenChange={onOpenChange} />);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('toggles on the shortcut with either modifier, and only on it', () => {
        const toggle = vi.fn();
        const { unmount } = renderHook(() => useSettingsShortcut(toggle));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: ',' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        });
        expect(toggle).toHaveBeenCalledTimes(2);
        unmount();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true }));
        expect(toggle).toHaveBeenCalledTimes(2);
    });
});

describe('a provider key in the settings', () => {
    it('lists the providers with the status of their keys', async () => {
        stubBrooz({ 'brooz:key-status': () => ({ present: true, canStore: true }) });
        render(<ProviderKey provider={FINNHUB} />);
        expect(await screen.findByText('Key stored')).toBeTruthy();
        expect(screen.getByText('Finnhub API key')).toBeTruthy();
        expect(screen.getByText('Test')).toBeTruthy();
        expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('opens the key page over the main process on a click', async () => {
        const invoke = stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true })
        });
        render(<ProviderKey provider={FINNHUB} />);
        fireEvent.click(await screen.findByText('Get a key at finnhub.io/register'));
        expect(invoke).toHaveBeenCalledWith('brooz:key-page', 'finnhub');
    });

    it('takes a key and saves it, then asks for the new status', async () => {
        const invoke = stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:key-set': () => ({ status: 'ok' })
        });
        render(<ProviderKey provider={FINNHUB} />);
        expect(await screen.findByText('No key')).toBeTruthy();
        expect(screen.queryByText('Test')).toBe(null);
        const input = screen.getByLabelText('Finnhub API key');
        expect(input).toBeTruthy();
        fireEvent.change(input, { target: { value: '  k1 ' } });
        fireEvent.click(screen.getByText('Save'));
        await screen.findByText('Key saved.');
        expect(invoke).toHaveBeenCalledWith('brooz:key-set', 'finnhub', '  k1 ');
        expect(invoke).toHaveBeenCalledWith('brooz:key-status', 'finnhub');
        expect((screen.getByLabelText('Finnhub API key') as HTMLInputElement).value).toBe('');
    });

    it('refuses to save when the system cannot store keys', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:key-set': () => ({ status: 'encryption-unavailable' })
        });
        render(<ProviderKey provider={FINNHUB} />);
        const input = await screen.findByLabelText('Finnhub API key');
        fireEvent.change(input, { target: { value: 'k1' } });
        fireEvent.click(screen.getByText('Save'));
        expect(await screen.findByText(/no encrypted place for keys/)).toBeTruthy();
    });

    it('locks the input when the system has no keyring', async () => {
        stubBrooz({ 'brooz:key-status': () => ({ present: false, canStore: false }) });
        render(<ProviderKey provider={FINNHUB} />);
        expect(await screen.findByText('No keyring')).toBeTruthy();
        expect(screen.getByText(/no encrypted place for keys/)).toBeTruthy();
        expect((screen.getByLabelText('Finnhub API key') as HTMLInputElement).disabled).toBe(true);
        expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    });

    it('tests a stored key and shows what the provider said', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: true, canStore: true }),
            'brooz:key-test': () => ({
                status: 'provider-error',
                message: 'Finnhub replied with 403.'
            })
        });
        render(<ProviderKey provider={FINNHUB} />);
        fireEvent.click(await screen.findByText('Test'));
        expect(
            await screen.findByText('The provider said: Finnhub replied with 403.')
        ).toBeTruthy();
    });

    it('celebrates a key that works', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: true, canStore: true }),
            'brooz:key-test': () => ({ status: 'ok' })
        });
        render(<ProviderKey provider={FINNHUB} />);
        fireEvent.click(await screen.findByText('Test'));
        expect(await screen.findByText('The key works.')).toBeTruthy();
    });

    it('says there is no key to test when the probe finds none', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: true, canStore: true }),
            'brooz:key-test': () => ({ status: 'missing-key', reason: 'not-set' })
        });
        render(<ProviderKey provider={FINNHUB} />);
        fireEvent.click(await screen.findByText('Test'));
        expect(await screen.findByText('There is no key to test.')).toBeTruthy();
    });

    it('deletes a stored key and refreshes the status', async () => {
        const invoke = stubBrooz({
            'brooz:key-status': () => ({ present: true, canStore: true }),
            'brooz:key-delete': () => undefined
        });
        render(<ProviderKey provider={FINNHUB} />);
        fireEvent.click(await screen.findByText('Delete'));
        expect(await screen.findByText('Key removed.')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:key-delete', 'finnhub');
        expect(invoke).toHaveBeenCalledWith('brooz:key-status', 'finnhub');
    });

    it('shows the error and recovers when an action rejects', async () => {
        stubBrooz({
            'brooz:key-status': () => ({ present: false, canStore: true }),
            'brooz:key-set': () => {
                throw new Error(
                    "Error invoking remote method 'brooz:key-set': RangeError: A key has 1 to 256 characters."
                );
            }
        });
        render(<ProviderKey provider={FINNHUB} />);
        const input = await screen.findByLabelText('Finnhub API key');
        fireEvent.change(input, { target: { value: 'k1' } });
        fireEvent.click(screen.getByText('Save'));
        expect(await screen.findByText('A key has 1 to 256 characters.')).toBeTruthy();
        fireEvent.change(input, { target: { value: 'k2' } });
        expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
    });

    it('says it is checking while the status loads', async () => {
        window.brooz = {
            invoke: vi.fn(() => new Promise(() => undefined))
        } as never;
        render(<ProviderKey provider={FINNHUB} />);
        expect(screen.getByText('Checking')).toBeTruthy();
        expect(screen.getByText('Save')).toBeTruthy();
    });
});

describe('the quick actions in the settings', () => {
    afterEach(() => localStorage.clear());

    const KEY = 'brooz.quick-actions';
    const DEFAULTS = [
        'weather in Rome',
        'air quality in Beijing',
        'how is apple stock doing',
        'surf forecast',
        'where is flight LH123'
    ];

    function open(): void {
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    }

    const utterances = () =>
        (screen.queryAllByLabelText(/^Utterance/) as HTMLInputElement[]).map(
            (input) => input.value
        );
    const stored = () => JSON.parse(localStorage.getItem(KEY)!);
    const edit = (label: string, value: string) => {
        const input = screen.getByLabelText(label);
        fireEvent.change(input, { target: { value } });
        fireEvent.blur(input);
    };

    it('lists the defaults until the person changes one, then keeps the whole list', () => {
        open();
        expect(utterances()).toEqual(DEFAULTS);
        expect(localStorage.getItem(KEY)).toBeNull();
        const label = screen.getByLabelText('Label 5');
        edit('Label 5', ' My flight ');
        // The row stays in place when it saves, so the focus can move on within it.
        expect(label.isConnected).toBe(true);
        expect(stored()).toEqual([
            ...DEFAULTS.slice(0, 4).map((utterance) => ({ label: '', utterance })),
            { label: 'My flight', utterance: 'where is flight LH123' }
        ]);
    });

    it('saves nothing for a field left unchanged or an utterance left empty', () => {
        open();
        edit('Utterance 1', 'weather in Rome');
        edit('Utterance 2', '  ');
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(utterances()).toEqual(DEFAULTS);
    });

    it('deletes quick actions, and a list deleted to the last one stays empty', () => {
        open();
        const deleteFirst = () =>
            fireEvent.click(screen.getByRole('button', { name: 'Delete quick action 1' }));
        deleteFirst();
        expect(utterances()).toEqual(DEFAULTS.slice(1));
        DEFAULTS.slice(1).forEach(deleteFirst);
        expect(stored()).toEqual([]);
        expect(utterances()).toEqual([]);
    });

    it('adds a quick action with or without a label, never without an utterance, up to eight', () => {
        open();
        const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
        const label = screen.getByLabelText('New label') as HTMLInputElement;
        const utterance = screen.getByLabelText('New utterance') as HTMLInputElement;
        const type = (input: HTMLInputElement, value: string) =>
            fireEvent.change(input, { target: { value } });

        type(label, 'Nothing to ask');
        type(utterance, '  ');
        expect(add.disabled).toBe(true);
        type(label, ' My flight ');
        type(utterance, ' track flight LH1234 ');
        fireEvent.click(add);
        expect(stored()[5]).toEqual({ label: 'My flight', utterance: 'track flight LH1234' });
        expect([label.value, utterance.value]).toEqual(['', '']);

        type(utterance, 'weather in Oslo');
        fireEvent.click(add);
        expect(stored()[6]).toEqual({ label: '', utterance: 'weather in Oslo' });
        type(utterance, 'surf forecast');
        fireEvent.click(add);
        expect(stored()).toHaveLength(8);
        type(utterance, 'price of bitcoin');
        expect(add.disabled).toBe(true);
    });
});

describe('the search terms of a tile section', () => {
    it('names the options a tile has', () => {
        const multi = {
            id: 'demo',
            title: 'Demo',
            Component: () => null,
            place: true,
            ownPlace: true,
            providers: [
                { provider: OPENWEATHERMAP, channel: 'brooz:weather' },
                { provider: FINNHUB, channel: 'brooz:stock-quotes' }
            ]
        } as const satisfies TileDefinition;
        expect(tileTerms(multi)).toEqual(['Demo', 'Location', 'City', 'Surf spot', 'Provider']);
        expect(tileTerms({ id: 'plain', title: 'Plain', Component: () => null })).toEqual([
            'Plain'
        ]);
    });
});

describe('the serves line of a provider section', () => {
    it('names the served tiles, or that none is served yet', async () => {
        const { servesLine } = await import('../../src/renderer/shell/settings/settings');
        expect(servesLine(['Weather', 'Air Quality'])).toBe('Serves Weather and Air Quality');
        expect(servesLine(['Markets'])).toBe('Serves Markets');
        expect(servesLine([])).toBe('Serves no tile yet');
    });
});

describe('the provider choice of a tile', () => {
    afterEach(() => localStorage.clear());

    const multiTile = {
        id: 'demo',
        title: 'Demo',
        Component: () => null,
        providers: [
            { provider: OPENWEATHERMAP, channel: 'brooz:weather' },
            { provider: FINNHUB, channel: 'brooz:stock-quotes' }
        ]
    } as const satisfies TileDefinition;

    const singleTile = {
        id: 'solo',
        title: 'Solo',
        Component: () => null,
        providers: [{ provider: FINNHUB, channel: 'brooz:stock-quotes' }]
    } as const satisfies TileDefinition;

    it('shows nothing for tiles with a single candidate or no provider at all', () => {
        const keyless = {
            id: 'plain',
            title: 'Plain',
            Component: () => null
        } as const satisfies TileDefinition;
        const { container, rerender } = render(<TileProviderChoice tile={singleTile} />);
        expect(container.firstChild).toBe(null);
        rerender(<TileProviderChoice tile={keyless} />);
        expect(container.firstChild).toBe(null);
    });

    it('defaults to the first candidate and stores the picked provider per tile', () => {
        render(<TileProviderChoice tile={multiTile} />);
        const radio = screen.getByRole('radio', { name: 'OpenWeatherMap' });
        expect((radio as HTMLInputElement).checked).toBe(true);
        expect(localStorage.getItem('brooz.tile.demo.provider')).toBe(null);

        const other = screen.getByRole('radio', { name: 'Finnhub' });
        expect((other as HTMLInputElement).checked).toBe(false);
        fireEvent.click(other);
        expect(localStorage.getItem('brooz.tile.demo.provider')).toBe('"finnhub"');
        expect((other as HTMLInputElement).checked).toBe(true);
        expect((radio as HTMLInputElement).checked).toBe(false);
    });

    it('reads a stored choice when the tile section opens', () => {
        localStorage.setItem('brooz.tile.demo.provider', '"finnhub"');
        render(<TileProviderChoice tile={multiTile} />);
        expect((screen.getByRole('radio', { name: 'Finnhub' }) as HTMLInputElement).checked).toBe(
            true
        );
    });
});

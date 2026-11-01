import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { FINNHUB } from '../../src/shared/providers';
import { ProviderKey } from '../../src/renderer/shell/settings/provider-key';
import { Settings, useSettingsShortcut } from '../../src/renderer/shell/settings/settings';
import { stubBrooz } from './stubs';

describe('the settings', () => {
    const status = () =>
        stubBrooz({ 'brooz:key-status': () => ({ present: false, canStore: true }) });

    it('lists a section for every tile with a provider, in grid order', async () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const nav = screen.getByRole('navigation', { name: 'Settings sections' });
        expect(
            within(nav)
                .getAllByRole('button')
                .map((button) => button.textContent)
        ).toEqual(['Weather', 'Markets', 'Air Quality']);
        expect(await screen.findByText('No key')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Weather' })).toBeTruthy();
        expect(screen.getByLabelText('OpenWeatherMap API key')).toBeTruthy();
    });

    it('turns the device location off and on, for every weather tile at once', () => {
        localStorage.clear();
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const option = screen.getByLabelText(/Use device location/) as HTMLInputElement;
        expect(option.checked).toBe(true);
        fireEvent.click(option);
        expect(option.checked).toBe(false);
        expect(localStorage.getItem('brooz.location.enabled')).toBe('false');
        fireEvent.click(screen.getByRole('button', { name: 'Markets' }));
        expect(screen.queryByLabelText(/Use device location/)).toBe(null);
        localStorage.clear();
    });

    it('opens the section a person picks', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Markets' }));
        expect(screen.getByRole('heading', { name: 'Markets' })).toBeTruthy();
        expect(screen.getByLabelText('Finnhub API key')).toBeTruthy();
    });

    it('filters the sections by tile title and provider name', () => {
        status();
        render(<Settings open onOpenChange={vi.fn()} />);
        const search = screen.getByLabelText('Search settings');
        fireEvent.change(search, { target: { value: 'finn' } });
        expect(screen.getByRole('heading', { name: 'Markets' })).toBeTruthy();
        fireEvent.change(search, { target: { value: ' AIR ' } });
        expect(screen.getByRole('heading', { name: 'Air Quality' })).toBeTruthy();
        fireEvent.change(search, { target: { value: 'nothing like it' } });
        expect(screen.getByText('No setting matches.')).toBeTruthy();
        expect(screen.queryByRole('region')).toBe(null);
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

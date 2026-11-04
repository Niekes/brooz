import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { App } from '../../src/renderer/App';
import { stubMatchMedia, stubWorker } from './stubs';

describe('the dashboard shell', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        stubWorker();
        vi.stubGlobal('requestAnimationFrame', () => 1);
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        stubMatchMedia(false);
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('renders the grid of every registered tile and the ask bar', async () => {
        render(<App />);
        expect(screen.getByLabelText('Ask your dashboard')).toBeTruthy();
        expect(screen.getAllByText('About').length).toBeGreaterThan(0);
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getAllByText('Brooz 0.1.0').length).toBeGreaterThan(0);
    });

    it('summons a tile from the ask bar onto the grid', async () => {
        const invoke = vi.fn((channel: string) =>
            Promise.resolve(
                channel === 'brooz:app-version'
                    ? '0.1.0'
                    : { status: 'missing-key', reason: 'not-set' }
            )
        );
        window.brooz = { invoke: invoke as unknown as typeof window.brooz.invoke };
        render(<App />);
        const input = screen.getByLabelText('Ask your dashboard');
        fireEvent.change(input, { target: { value: 'weather in Rome' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await act(async () => {});
        expect(screen.getByText('Needs an API key from OpenWeatherMap.')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('brooz:weather', { city: 'Rome' });
    });

    it('opens the settings from an empty tile of the grid', () => {
        render(<App />);
        expect(screen.queryByRole('dialog')).toBe(null);
        fireEvent.click(screen.getAllByLabelText('Default tile, open the settings')[0]);
        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    });

    it('opens and closes the settings with the shortcut and the button', () => {
        render(<App />);
        expect(screen.queryByRole('dialog')).toBe(null);
        fireEvent.keyDown(window, { key: ',', metaKey: true });
        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
        fireEvent.keyDown(window, { key: ',', ctrlKey: true });
        expect(screen.queryByRole('dialog')).toBe(null);
        fireEvent.click(screen.getByText('Settings Ctrl+,'));
        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    });
});

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

    it('summons a tile from the ask bar onto the grid', () => {
        render(<App />);
        const input = screen.getByLabelText('Ask your dashboard');
        fireEvent.change(input, { target: { value: 'start a 10 minute timer' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText('10:00')).toBeTruthy();
        expect(screen.getByText('10 min')).toBeTruthy();
    });
});

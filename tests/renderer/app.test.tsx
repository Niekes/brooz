import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { App } from '../../src/renderer/App';

describe('the dashboard shell', () => {
    beforeEach(() => {
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
    });

    it('renders every registered tile', async () => {
        render(<App />);
        expect(screen.getByText('About')).toBeTruthy();
        expect(await screen.findByText('brooz 0.1.0')).toBeTruthy();
    });
});

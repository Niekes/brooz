import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { AboutTileBody } from '../../src/renderer/tiles/about';

describe('the about tile', () => {
    it('shows the app version over IPC', async () => {
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
        render(<AboutTileBody />);
        expect(await screen.findByText('Brooz 0.1.0')).toBeTruthy();
    });

    it('ignores the version when the tile is gone before it arrives', async () => {
        let resolveVersion!: (version: string) => void;
        window.brooz = {
            invoke: vi.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolveVersion = resolve;
                    })
            )
        };
        const { unmount } = render(<AboutTileBody />);
        unmount();
        resolveVersion('9.9.9');
        await Promise.resolve();
        expect(screen.queryByText('Brooz 9.9.9')).toBe(null);
    });
});

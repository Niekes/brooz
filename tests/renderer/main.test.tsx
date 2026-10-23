import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

describe('the renderer entry', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
        vi.resetModules();
    });

    it('mounts the shell into #root', async () => {
        await act(async () => {
            await import('../../src/renderer/main');
            // Let the version request of the about tile settle inside act.
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(screen.getByText('About')).toBeTruthy();
        expect(screen.getByText('brooz 0.1.0')).toBeTruthy();
    });
});

import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { stubMatchMedia, stubWorker } from './stubs';

describe('the renderer entry', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        window.brooz = { invoke: vi.fn().mockResolvedValue('0.1.0') };
        stubWorker();
        vi.stubGlobal('requestAnimationFrame', () => 1);
        stubMatchMedia(false);
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('mounts the shell into #root', async () => {
        await act(async () => {
            await import('../../src/renderer/main');
            // Let the version request of the about tile settle inside act.
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(screen.getAllByText('About').length).toBeGreaterThan(0);
        expect(screen.getAllByText('brooz 0.1.0').length).toBeGreaterThan(0);
    });
});

import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { MODEL_DELAY } from '../../src/renderer/shell/command/use-model-routing';
import { stubMatchMedia, stubWorker } from './stubs';

const invoke = vi.fn();

describe('the renderer entry', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        invoke.mockReset().mockResolvedValue('0.1.0');
        window.brooz = { invoke };
        stubWorker();
        vi.stubGlobal('requestAnimationFrame', () => 1);
        stubMatchMedia(false);
        vi.resetModules();
    });

    afterEach(async () => {
        // main.tsx mounts its own root, which the testing library's cleanup
        // does not unmount: let the command bar's mount debounce fire while
        // the DOM is still alive, or its timer outlives the jsdom environment
        // and fails the run as unhandled.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, MODEL_DELAY + 60));
        });
        vi.unstubAllGlobals();
    });

    async function start(): Promise<void> {
        await act(async () => {
            await import('../../src/renderer/main');
        });
        await waitFor(() => expect(screen.getAllByText('Brooz 0.1.0').length).toBeGreaterThan(0));
    }

    it('mounts the shell into #root once the style nonce is set', async () => {
        await start();
        expect(screen.getAllByText('About').length).toBeGreaterThan(0);
        expect(invoke).toHaveBeenCalledWith('brooz:style-nonce');
        const { getNonce } = await import('get-nonce');
        expect(getNonce()).toBe('0.1.0');
    });

    it('mounts the shell even without a nonce', async () => {
        invoke.mockImplementation((channel: string) =>
            channel === 'brooz:style-nonce'
                ? Promise.reject(new Error('no nonce'))
                : Promise.resolve('0.1.0')
        );
        await start();
        expect(screen.getAllByText('About').length).toBeGreaterThan(0);
    });
});

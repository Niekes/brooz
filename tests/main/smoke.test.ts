import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { BrowserWindow } from 'electron';
import { isSmokeTest, runSmokeTest } from '../../src/main/smoke';

const mockExit = vi.fn();

vi.mock('electron', () => ({
    app: {
        exit: (...args: unknown[]) => mockExit(...args)
    }
}));

function fakeWindow(result: Promise<unknown>) {
    let loaded!: () => void;
    const executeJavaScript = vi.fn(() => result);
    const window = {
        webContents: {
            once: (_event: string, listener: () => void) => {
                loaded = listener;
            },
            executeJavaScript
        }
    } as unknown as BrowserWindow;
    return { window, executeJavaScript, load: () => loaded() };
}

describe('the release smoke test', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        mockExit.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('runs only when the release workflow asks for it', () => {
        expect(isSmokeTest()).toBe(false);
        vi.stubEnv('BROOZ_SMOKE', '1');
        expect(isSmokeTest()).toBe(true);
    });

    it('checks the loaded window and exits 0 when it passes', async () => {
        const { window, executeJavaScript, load } = fakeWindow(Promise.resolve('ok'));
        runSmokeTest(window);
        expect(executeJavaScript).not.toHaveBeenCalled();
        load();
        await vi.waitFor(() => expect(mockExit).toHaveBeenCalledWith(0));
        expect(executeJavaScript.mock.calls[0]).toEqual([
            expect.stringContaining('start a 10 minute timer')
        ]);
        expect(console.log).toHaveBeenCalledWith('smoke: ok');
        vi.advanceTimersByTime(60_000);
        expect(mockExit).toHaveBeenCalledTimes(1);
    });

    it('exits 1 with the reason when the check fails', async () => {
        const { window, load } = fakeWindow(Promise.reject(new Error('title is brooz')));
        runSmokeTest(window);
        load();
        await vi.waitFor(() => expect(mockExit).toHaveBeenCalledWith(1));
        expect(console.log).toHaveBeenCalledWith('smoke: title is brooz');
    });

    it('reports a failure that is not an Error', async () => {
        const { window, load } = fakeWindow(Promise.reject('crashed'));
        runSmokeTest(window);
        load();
        await vi.waitFor(() => expect(console.log).toHaveBeenCalledWith('smoke: crashed'));
    });

    it('exits 1 when the window never finishes', () => {
        const { window } = fakeWindow(new Promise(() => undefined));
        runSmokeTest(window);
        vi.advanceTimersByTime(60_000);
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(console.log).toHaveBeenCalledWith('smoke: timed out');
    });
});

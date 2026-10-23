import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mockExposeInMainWorld = vi.fn();
const mockInvoke = vi.fn((_channel: unknown, ..._args: unknown[]) => Promise.resolve('0.1.0'));

vi.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: (...args: unknown[]) => mockExposeInMainWorld(...args)
    },
    ipcRenderer: {
        invoke: (channel: unknown, ...args: unknown[]) => mockInvoke(channel, ...args)
    }
}));

async function loadBridge(): Promise<[string, { invoke(channel: string): Promise<unknown> }]> {
    await import('../../src/preload/index');
    return mockExposeInMainWorld.mock.calls[0] as [
        string,
        { invoke(channel: string): Promise<unknown> }
    ];
}

describe('the preload bridge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('exposes the brooz API on the window', async () => {
        const [name] = await loadBridge();
        expect(name).toBe('brooz');
    });

    it('forwards a channel of the contract to ipcRenderer.invoke', async () => {
        const [, bridge] = await loadBridge();
        const result = await bridge.invoke('brooz:app-version');
        expect(mockInvoke).toHaveBeenCalledWith('brooz:app-version');
        expect(result).toBe('0.1.0');
    });

    it('rejects an unknown channel without touching ipcRenderer', async () => {
        const [, bridge] = await loadBridge();
        await expect(bridge.invoke('brooz:unknown')).rejects.toThrow('Unknown IPC channel');
        expect(mockInvoke).not.toHaveBeenCalled();
    });
});

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { registerIpcHandlers } from '../../src/main/ipc';

const mockHandle = vi.fn();
const mockGetVersion = vi.fn(() => '0.1.0');

vi.mock('electron', () => ({
    app: {
        getVersion: () => mockGetVersion()
    },
    ipcMain: {
        handle: (...args: unknown[]) => mockHandle(...args)
    }
}));

type VersionHandler = (event: { senderFrame: { url: string } | null }) => string;

function registeredHandler(): VersionHandler {
    const calls = mockHandle.mock.calls as unknown as [string, VersionHandler][];
    expect(calls[0][0]).toBe('brooz:app-version');
    return calls[0][1];
}

const sender = (url: string) => ({ senderFrame: { url } });

describe('the IPC handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the app version channel', () => {
        registerIpcHandlers();
        expect(mockHandle).toHaveBeenCalledTimes(1);
    });

    it('answers the app version for an app:// sender', () => {
        registerIpcHandlers();
        expect(registeredHandler()(sender('app://app/index.html'))).toBe('0.1.0');
    });

    it('answers the dev server while it is running', () => {
        registerIpcHandlers('http://localhost:5173/');
        expect(registeredHandler()(sender('http://localhost:5173/'))).toBe('0.1.0');
    });

    it('rejects a sender without a frame', () => {
        registerIpcHandlers('http://localhost:5173/');
        expect(() => registeredHandler()({ senderFrame: null })).toThrow(
            /Rejected IPC call from $/
        );
    });

    it('rejects any other sender', () => {
        registerIpcHandlers('http://localhost:5173/');
        expect(() => registeredHandler()(sender('https://example.com'))).toThrow(
            /Rejected IPC call from https:\/\/example\.com/
        );
    });
});

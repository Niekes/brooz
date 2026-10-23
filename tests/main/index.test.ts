import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const mockWhenReady = vi.fn(() => Promise.resolve());
const mockOn = vi.fn();
const mockQuit = vi.fn();
const mockGetAllWindows = vi.fn((): unknown[] => []);
const mockRegisterSchemesAsPrivileged = vi.fn();
const mockRegisterIpcHandlers = vi.fn();
const mockRegisterAppProtocol = vi.fn();
const mockConfigureUpdater = vi.fn();
const mockCreateMainWindow = vi.fn();

vi.mock('electron', () => ({
    BrowserWindow: {
        getAllWindows: () => mockGetAllWindows()
    },
    app: {
        whenReady: () => mockWhenReady(),
        on: (...args: unknown[]) => mockOn(...args),
        quit: (...args: unknown[]) => mockQuit(...args),
        getAppPath: () => '/app'
    },
    protocol: {
        registerSchemesAsPrivileged: (...args: unknown[]) =>
            mockRegisterSchemesAsPrivileged(...args)
    }
}));

vi.mock('../../src/main/ipc', () => ({
    registerIpcHandlers: (...args: unknown[]) => mockRegisterIpcHandlers(...args)
}));
vi.mock('../../src/main/protocol', () => ({
    APP_SCHEME_PRIVILEGES: [{ scheme: 'app', privileges: {} }],
    registerAppProtocol: (...args: unknown[]) => mockRegisterAppProtocol(...args)
}));
vi.mock('../../src/main/updater', () => ({
    configureUpdater: () => mockConfigureUpdater()
}));
vi.mock('../../src/main/window', () => ({
    createMainWindow: (...args: unknown[]) => mockCreateMainWindow(...args)
}));

function appListener(name: string): () => void {
    const call = mockOn.mock.calls.find((args) => args[0] === name);
    if (call === undefined) {
        throw new Error(`No listener for '${name}' registered yet.`);
    }
    return call[1] as () => void;
}

function withPlatform(platform: 'darwin' | 'linux', run: () => void): void {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    try {
        run();
    } finally {
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    }
}

async function startApp(): Promise<void> {
    await import('../../src/main/index');
    await vi.waitFor(() => expect(mockCreateMainWindow).toHaveBeenCalledTimes(1));
}

describe('the main process lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('registers the app scheme before the app is ready', async () => {
        await startApp();
        expect(mockRegisterSchemesAsPrivileged).toHaveBeenCalledWith([
            { scheme: 'app', privileges: {} }
        ]);
    });
    it('starts the app once Electron is ready', async () => {
        await startApp();
        expect(mockRegisterAppProtocol).toHaveBeenCalledTimes(1);
        expect(mockRegisterIpcHandlers).toHaveBeenCalledWith(undefined);
        expect(mockCreateMainWindow).toHaveBeenCalledWith(undefined);
        expect(mockConfigureUpdater).toHaveBeenCalledTimes(1);
    });

    it('quits when the last window closes, except on macOS', async () => {
        await startApp();
        const windowAllClosed = appListener('window-all-closed');
        withPlatform('darwin', windowAllClosed);
        expect(mockQuit).not.toHaveBeenCalled();
        withPlatform('linux', windowAllClosed);
        expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('reopens a window on activate when none is left', async () => {
        await startApp();
        const activate = appListener('activate');
        mockGetAllWindows.mockReturnValueOnce([]);
        activate();
        expect(mockCreateMainWindow).toHaveBeenCalledTimes(2);
        mockGetAllWindows.mockReturnValueOnce([{}]);
        activate();
        expect(mockCreateMainWindow).toHaveBeenCalledTimes(2);
    });
});

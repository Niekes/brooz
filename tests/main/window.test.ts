import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { join } from 'node:path';
import { APP_INDEX_URL } from '../../src/main/protocol';
import {
    createMainWindow,
    createWindowOptions,
    installPermissionHandler,
    PERMISSION_ALLOWLIST
} from '../../src/main/window';

type NavigateHandler = (event: { preventDefault: () => void }, url: string) => void;

interface MockWindow {
    options: Record<string, unknown>;
    once: ReturnType<typeof vi.fn>;
    loadURL: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    webContents: {
        on: ReturnType<typeof vi.fn>;
        setWindowOpenHandler: ReturnType<typeof vi.fn>;
        session: { setPermissionRequestHandler: ReturnType<typeof vi.fn> };
    };
}

const mockInstances: MockWindow[] = [];

vi.mock('electron', () => ({
    BrowserWindow: class {
        options: Record<string, unknown>;
        once = vi.fn();
        loadURL = vi.fn();
        show = vi.fn();
        webContents = {
            on: vi.fn(),
            setWindowOpenHandler: vi.fn(),
            session: { setPermissionRequestHandler: vi.fn() }
        };
        constructor(options: Record<string, unknown>) {
            this.options = options;
            mockInstances.push(this as unknown as MockWindow);
        }
    },
    app: {
        getAppPath: () => '/app'
    }
}));

function windowInstance(): MockWindow {
    return mockInstances[0];
}

function navigateHandler(): NavigateHandler {
    const calls = windowInstance().webContents.on.mock.calls as unknown as [
        string,
        NavigateHandler
    ][];
    return calls[0][1];
}

function readyHandler(): () => void {
    const calls = windowInstance().once.mock.calls as unknown as [string, () => void][];
    return calls[0][1];
}

describe('the main window', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInstances.length = 0;
    });

    it('pins the security baseline of the Electron checklist', () => {
        const options = createWindowOptions('/app/dist/preload/index.cjs');
        expect(options.webPreferences).toEqual({
            preload: '/app/dist/preload/index.cjs',
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false
        });
    });

    it('uses the bundled preload script', () => {
        createMainWindow();
        expect(windowInstance().options.webPreferences).toMatchObject({
            preload: join('/app', 'dist', 'preload', 'index.cjs')
        });
    });

    it('loads the app:// protocol, never a file:// URL', () => {
        createMainWindow();
        expect(windowInstance().loadURL).toHaveBeenCalledWith(APP_INDEX_URL);
    });

    it('loads the dev server instead while it is running', () => {
        createMainWindow('http://localhost:5173/');
        expect(windowInstance().loadURL).toHaveBeenCalledWith('http://localhost:5173/');
    });

    it('denies every permission request while the allowlist is empty', () => {
        expect(PERMISSION_ALLOWLIST).toEqual([]);
        const handler = vi.fn();
        installPermissionHandler({
            setPermissionRequestHandler: handler
        } as unknown as Electron.Session);
        const requestHandler = handler.mock.calls[0][0] as (
            webContents: unknown,
            permission: string,
            callback: (granted: boolean) => void
        ) => void;
        const granted: boolean[] = [];
        requestHandler(undefined, 'media', (value) => granted.push(value));
        requestHandler(undefined, 'notifications', (value) => granted.push(value));
        expect(granted).toEqual([false, false]);
    });

    it('denies every request to open a new window', () => {
        createMainWindow();
        const calls = windowInstance().webContents.setWindowOpenHandler.mock.calls as unknown as [
            [],
            () => { action: string }
        ][];
        expect(calls.length).toBe(1);
        expect((calls[0] as unknown as [() => { action: string }])[0]()).toEqual({
            action: 'deny'
        });
    });

    it('prevents navigation away from the app', () => {
        createMainWindow();
        const prevented = { preventDefault: vi.fn() };
        navigateHandler()(prevented, 'https://example.com');
        expect(prevented.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('allows navigation inside the app', () => {
        createMainWindow();
        const prevented = { preventDefault: vi.fn() };
        navigateHandler()(prevented, APP_INDEX_URL);
        expect(prevented.preventDefault).not.toHaveBeenCalled();
    });

    it('shows the window once it is ready', () => {
        createMainWindow();
        expect(windowInstance().show).not.toHaveBeenCalled();
        readyHandler()();
        expect(windowInstance().show).toHaveBeenCalledTimes(1);
    });
});

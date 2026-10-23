import { BrowserWindow } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import { preloadPath } from './paths';
import { isAppOrigin } from './origin';
import { APP_INDEX_URL } from './protocol';

/**
 * The security baseline of every window of the app. The unit test pins each
 * option: context isolation and the sandbox on, Node integration off.
 */
export function createWindowOptions(preload: string): BrowserWindowConstructorOptions {
    return {
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            preload,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false
        }
    };
}

/**
 * The one window of the shell. In dev mode it loads the Vite dev server,
 * packaged it loads the app:// protocol, never a `file://` URL.
 */
export function createMainWindow(devUrl?: string): BrowserWindow {
    const window = new BrowserWindow(createWindowOptions(preloadPath()));

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    window.webContents.on('will-navigate', (event, url) => {
        if (!isAppOrigin(url, devUrl)) {
            event.preventDefault();
        }
    });

    window.once('ready-to-show', () => window.show());

    if (devUrl === undefined) {
        void window.loadURL(APP_INDEX_URL);
    } else {
        void window.loadURL(devUrl);
    }
    return window;
}

import { BrowserWindow, app, protocol } from 'electron';
import { registerIpcHandlers } from './ipc';
import { rendererRoot } from './paths';
import { APP_SCHEME_PRIVILEGES, registerAppProtocol } from './protocol';
import { isSmokeTest, runSmokeTest } from './smoke';
import { configureUpdater } from './updater';
import { createMainWindow } from './window';

// Set by scripts/dev.mjs while the Vite dev server is running.
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

// The app:// scheme needs its privileges before the app is ready.
protocol.registerSchemesAsPrivileged(APP_SCHEME_PRIVILEGES);

function start(): void {
    registerAppProtocol(rendererRoot());
    registerIpcHandlers(DEV_URL);
    const window = createMainWindow(DEV_URL);
    // The release smoke test checks the window and quits; it never updates.
    if (isSmokeTest()) {
        runSmokeTest(window);
        return;
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow(DEV_URL);
        }
    });
    configureUpdater();
}

void app.whenReady().then(start);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

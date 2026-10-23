import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import { isAppOrigin } from './origin';

/**
 * Registers every IPC handler of the contract. Each handler only answers
 * frames from the app itself: the app:// origin, or the dev server.
 */
export function registerIpcHandlers(devUrl?: string): void {
    ipcMain.handle(IPC_CHANNELS.appVersion, (event) => {
        const senderUrl = event.senderFrame?.url ?? '';
        if (!isAppOrigin(senderUrl, devUrl)) {
            throw new Error(`Rejected IPC call from ${senderUrl}`);
        }
        return app.getVersion();
    });
}

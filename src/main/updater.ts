import { app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';

const RELEASES_URL = 'https://github.com/Niekes/brooz/releases/latest';

/**
 * Auto-update over GitHub Releases. electron-updater only ever sees
 * published releases, and the release workflow publishes only after the
 * packaged apps passed their smoke test: a broken build stays a draft.
 *
 * macOS stays notify-only: Squirrel.Mac refuses to update an unsigned app,
 * so it opens the releases page instead of downloading.
 */
export function configureUpdater(): void {
    if (!app.isPackaged) {
        return;
    }
    if (process.platform === 'darwin') {
        // ponytail: notify-only on macOS until the app is signed, then drop this branch
        autoUpdater.autoDownload = false;
        autoUpdater.on('update-available', () => {
            void shell.openExternal(RELEASES_URL);
        });
        return;
    }
    void autoUpdater.checkForUpdatesAndNotify();
}

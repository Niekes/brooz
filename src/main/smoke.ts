import { app } from 'electron';
import type { BrowserWindow } from 'electron';

/** How long the whole check may take before it counts as failed. */
const SMOKE_TIMEOUT = 60_000;

/**
 * The check, run inside the window: the dome renders its tiles, the title
 * is the product name, the window is cross-origin isolated, and the ask bar
 * turns a pomodoro live. It needs no network, so it runs on any CI runner.
 */
const CHECK = `new Promise((resolve, reject) => {
    const deadline = Date.now() + ${SMOKE_TIMEOUT - 5_000};
    const waitFor = (test, what, next) => {
        if (test()) return next();
        if (Date.now() > deadline) return reject(new Error('timed out waiting for ' + what));
        setTimeout(() => waitFor(test, what, next), 100);
    };
    waitFor(() => document.querySelectorAll('[data-index]').length >= 25, 'the tiles', () => {
        if (document.title !== 'Brooz') return reject(new Error('title is ' + document.title));
        if (!crossOriginIsolated) return reject(new Error('the window is not cross-origin isolated'));
        const input = document.querySelector('input[aria-label="Ask your dashboard"]');
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setValue.call(input, 'start a 10 minute timer');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        waitFor(() => document.body.textContent.includes('In focus'), 'the live pomodoro', () =>
            resolve('ok')
        );
    });
})`;

/**
 * Whether the app runs as the release smoke test. The release workflow sets
 * BROOZ_SMOKE=1 on the packaged app, which Playwright cannot drive: the
 * fuses turn the inspector off.
 */
export function isSmokeTest(): boolean {
    return process.env.BROOZ_SMOKE === '1';
}

/** Runs the check once the window has loaded, then quits with its result. */
export function runSmokeTest(window: BrowserWindow): void {
    const finish = (code: number, message: string): void => {
        console.log(`smoke: ${message}`);
        app.exit(code);
    };
    const timer = setTimeout(() => finish(1, 'timed out'), SMOKE_TIMEOUT);
    window.webContents.once('did-finish-load', () => {
        window.webContents.executeJavaScript(CHECK).then(
            () => {
                clearTimeout(timer);
                finish(0, 'ok');
            },
            (cause: unknown) => {
                clearTimeout(timer);
                finish(1, cause instanceof Error ? cause.message : String(cause));
            }
        );
    });
}

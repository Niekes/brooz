import { join } from 'node:path';
import { app } from 'electron';

/**
 * The bundled renderer, served over the app:// protocol. In a packaged app
 * `app.getAppPath()` points into the asar archive, and the protocol handler
 * reads through it.
 */
export function rendererRoot(): string {
    return join(app.getAppPath(), 'dist', 'renderer');
}

/** The bundled preload script of the sandboxed renderer. */
export function preloadPath(): string {
    return join(app.getAppPath(), 'dist', 'preload', 'index.cjs');
}

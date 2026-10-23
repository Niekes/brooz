import { net, protocol } from 'electron';
import type { CustomScheme } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_SCHEME = 'app';
export const APP_INDEX_URL = 'app://app/index.html';

/**
 * `registerSchemesAsPrivileged` runs before the app is ready, so this is a
 * plain value that `src/main/index.ts` passes to it.
 */
export const APP_SCHEME_PRIVILEGES: CustomScheme[] = [
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
];

const CSP =
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "font-src 'self'; connect-src 'self'";

/**
 * Maps a request path to a file below the renderer root. `/` is the shell
 * document, every other path maps straight through. A request cannot
 * escape the root: the URL parser strips dot segments and `pathToFileURL`
 * percent-encodes everything else, so `..` never reaches the file system.
 */
export function resolveRendererPath(rendererRoot: string, pathname: string): string {
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    return join(rendererRoot, relative);
}

/**
 * Serves one request of the app:// protocol: the file from the renderer
 * bundle, with the Content-Security-Policy header on the shell document.
 */
export async function serveRenderer(rendererRoot: string, request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
        const response = await net.fetch(
            pathToFileURL(resolveRendererPath(rendererRoot, pathname)).toString(),
            { bypassCustomProtocolHandlers: true }
        );
        return withCsp(response, pathname);
    } catch {
        return new Response('Not found', { status: 404 });
    }
}

function withCsp(response: Response, pathname: string): Response {
    if (pathname !== '/' && pathname !== '/index.html') {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
}

/** Registers the protocol handler. Called once, when the app is ready. */
export function registerAppProtocol(rendererRoot: string): void {
    protocol.handle(APP_SCHEME, (request) => serveRenderer(rendererRoot, request));
}

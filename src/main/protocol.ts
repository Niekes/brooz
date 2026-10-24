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

/**
 * The Content-Security-Policy of the app. Everything comes from the app
 * itself, with two exceptions for the local model: 'wasm-unsafe-eval'
 * compiles the ONNX Runtime's WebAssembly, and connect-src reaches the
 * Hugging Face hub, where the model weights live (their downloads redirect
 * to *.hf.co).
 */
const CSP = [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://huggingface.co https://*.hf.co"
].join('; ');

/**
 * Sent with every response, not only the shell document: a worker script
 * takes its policy from its own response, so the model worker gets the same
 * CSP. COOP and COEP make the window cross-origin isolated, which the
 * WebAssembly threads of the ONNX Runtime need for SharedArrayBuffer.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
    'Content-Security-Policy': CSP,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
};

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
 * bundle, with the security headers.
 */
export async function serveRenderer(rendererRoot: string, request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
        const response = await net.fetch(
            pathToFileURL(resolveRendererPath(rendererRoot, pathname)).toString(),
            { bypassCustomProtocolHandlers: true }
        );
        return withSecurityHeaders(response);
    } catch {
        return new Response('Not found', { status: 404 });
    }
}

function withSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers });
}

/** Registers the protocol handler. Called once, when the app is ready. */
export function registerAppProtocol(rendererRoot: string): void {
    protocol.handle(APP_SCHEME, (request) => serveRenderer(rendererRoot, request));
}

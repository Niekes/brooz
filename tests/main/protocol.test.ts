import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    APP_INDEX_URL,
    APP_SCHEME,
    APP_SCHEME_PRIVILEGES,
    registerAppProtocol,
    resolveRendererPath,
    serveRenderer
} from '../../src/main/protocol';

const mockHandle = vi.fn();
const mockFetch = vi.fn();

vi.mock('electron', () => ({
    net: {
        fetch: (...args: unknown[]) => mockFetch(...args)
    },
    protocol: {
        handle: (...args: unknown[]) => mockHandle(...args)
    }
}));

const rendererRoot = '/app/dist/renderer';

describe('the app:// protocol', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('declares the scheme with the privileges it needs', () => {
        expect(APP_SCHEME).toBe('app');
        expect(APP_SCHEME_PRIVILEGES).toEqual([
            {
                scheme: 'app',
                privileges: { standard: true, secure: true, supportFetchAPI: true }
            }
        ]);
    });

    it('maps the shell document to index.html', () => {
        expect(resolveRendererPath(rendererRoot, '/')).toBe(join(rendererRoot, 'index.html'));
        expect(resolveRendererPath(rendererRoot, '/index.html')).toBe(
            join(rendererRoot, 'index.html')
        );
    });

    it('maps an asset path straight through', () => {
        expect(resolveRendererPath(rendererRoot, '/assets/app.js')).toBe(
            join(rendererRoot, 'assets/app.js')
        );
    });

    it('refuses a path that escapes the renderer root', () => {
        // The URL parser strips dot segments, so an escape attempt lands on a
        // path below the renderer root, not outside it.
        expect(new URL('app://app/../package.json').pathname).toBe('/package.json');
        expect(resolveRendererPath(rendererRoot, '/package.json')).toBe(
            join(rendererRoot, 'package.json')
        );
    });

    it('serves the shell document with the Content-Security-Policy header', async () => {
        mockFetch.mockResolvedValue(new Response('<html></html>'));
        const response = await serveRenderer(rendererRoot, {
            url: APP_INDEX_URL
        } as Request);
        expect(mockFetch).toHaveBeenCalledWith(
            pathToFileURL(join(rendererRoot, 'index.html')).toString(),
            { bypassCustomProtocolHandlers: true }
        );
        expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    });

    it('serves an asset without the Content-Security-Policy header', async () => {
        mockFetch.mockResolvedValue(
            new Response('console.log(1)', { headers: { 'Content-Type': 'text/javascript' } })
        );
        const response = await serveRenderer(rendererRoot, {
            url: 'app://app/assets/app.js'
        } as Request);
        expect(response.headers.get('Content-Security-Policy')).toBe(null);
    });

    it('answers a missing file with 404', async () => {
        mockFetch.mockRejectedValue(new Error('ENOENT'));
        const response = await serveRenderer(rendererRoot, {
            url: 'app://app/missing.js'
        } as Request);
        expect(response.status).toBe(404);
    });

    it('registers a handler that serves the renderer bundle', async () => {
        mockFetch.mockResolvedValue(new Response('<html></html>'));
        registerAppProtocol(rendererRoot);
        const [scheme, handler] = mockHandle.mock.calls[0] as [
            string,
            (request: Request) => Promise<Response>
        ];
        expect(scheme).toBe('app');
        const response = await handler({ url: APP_INDEX_URL } as Request);
        expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    });
});

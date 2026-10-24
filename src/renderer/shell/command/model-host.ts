import type { OpenJev, OpenJevRuntime } from 'open-jev';
import { routeIntent } from './route-intent';
import type { RouteOptions, RouteResult } from './route-intent';

/** What the page asks the model worker. */
export type HostRequest =
    | { type: 'load' }
    | { type: 'route'; id: number; text: string; options: RouteOptions };

/** What the model worker answers. */
export type HostMessage =
    | { type: 'progress'; progress: number }
    | { type: 'ready'; runtime: Pick<OpenJevRuntime, 'device' | 'dtype'> }
    | { type: 'load-error'; message: string }
    | { type: 'routed'; id: number; result: RouteResult }
    | { type: 'route-error'; id: number; message: string };

function messageOf(cause: unknown, fallback: string): string {
    return cause instanceof Error ? cause.message : fallback;
}

/**
 * The model side of the worker, free of any worker global so it can be
 * tested on its own. It loads the model once, reports the download
 * progress in whole percent, and answers route requests by id.
 */
export function createModelHost(
    post: (message: HostMessage) => void,
    loadModel: (onProgress: (progress: number) => void) => Promise<OpenJev>
): (request: HostRequest) => Promise<void> {
    let model: Promise<OpenJev> | null = null;

    async function load(): Promise<void> {
        model ??= loadModel((progress) =>
            post({ type: 'progress', progress: Math.round(progress * 100) })
        );
        try {
            const { device, dtype } = (await model).runtime;
            post({ type: 'ready', runtime: { device, dtype } });
        } catch (cause) {
            model = null;
            post({
                type: 'load-error',
                message: messageOf(cause, 'The local model could not be loaded.')
            });
        }
    }

    async function route(id: number, text: string, options: RouteOptions): Promise<void> {
        try {
            const result = await routeIntent(await model!, text, options);
            post({ type: 'routed', id, result });
        } catch (cause) {
            post({
                type: 'route-error',
                id,
                message: messageOf(cause, 'The local model could not route that.')
            });
        }
    }

    return (request) =>
        request.type === 'load' ? load() : route(request.id, request.text, request.options);
}

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { HostMessage, HostRequest } from './model-host';
import { ROUTED_TILES } from './manifest';
import type { RouteOptions, RouteResult } from './route-intent';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelState {
    status: ModelStatus;
    progress: number;
    error: string | null;
    runtime: { device: string; dtype: string } | null;
}

export interface LocalModel extends ModelState {
    load: () => void;
    route: (text: string) => Promise<RouteResult>;
}

const OPTIONS: RouteOptions = {
    ids: ROUTED_TILES.map((tile) => tile.id),
    descriptions: Object.fromEntries(ROUTED_TILES.map((tile) => [tile.id, tile.route.description]))
};

const INITIAL: ModelState = { status: 'idle', progress: 0, error: null, runtime: null };

type ModelEvent =
    | { type: 'load' }
    | Extract<HostMessage, { type: 'progress' | 'ready' | 'load-error' }>;

function reduce(state: ModelState, event: ModelEvent): ModelState {
    switch (event.type) {
        case 'load':
            return { ...state, status: 'loading', error: null, progress: 0 };
        case 'progress':
            return { ...state, progress: event.progress };
        case 'ready':
            return { ...state, status: 'ready', progress: 100, runtime: event.runtime };
        case 'load-error':
            return { ...state, status: 'error', error: event.message };
    }
}

interface Pending {
    resolve: (result: RouteResult) => void;
    reject: (cause: Error) => void;
}

/**
 * The model worker, created on the first request and terminated with the
 * component. Route answers settle their pending promise by id, every other
 * message goes to `onStatus`.
 */
function useModelWorker(onStatus: (event: ModelEvent) => void): {
    post: (request: HostRequest) => void;
    pending: Map<number, Pending>;
} {
    const workerRef = useRef<Worker | null>(null);
    const pendingRef = useRef(new Map<number, Pending>());

    const onMessage = useCallback(
        (message: HostMessage) => {
            const pending = pendingRef.current;
            if (message.type === 'routed') {
                pending.get(message.id)!.resolve(message.result);
                pending.delete(message.id);
            } else if (message.type === 'route-error') {
                pending.get(message.id)!.reject(new Error(message.message));
                pending.delete(message.id);
            } else {
                onStatus(message);
            }
        },
        [onStatus]
    );

    const post = useCallback(
        (request: HostRequest) => {
            if (!workerRef.current) {
                workerRef.current = new Worker(new URL('./model-worker.ts', import.meta.url), {
                    type: 'module'
                });
                workerRef.current.onmessage = (event: MessageEvent<HostMessage>) =>
                    onMessage(event.data);
            }
            workerRef.current.postMessage(request);
        },
        [onMessage]
    );

    useEffect(
        () => () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        },
        []
    );

    return { post, pending: pendingRef.current };
}

/**
 * Owns the local decision model, which lives in a Web Worker. Nothing is
 * downloaded until `load` is called; once ready, `route` asks the model and
 * resolves with its answer, before that it rejects.
 */
export function useLocalModel(): LocalModel {
    const [state, dispatch] = useReducer(reduce, INITIAL);
    const { post, pending } = useModelWorker(dispatch);
    const nextIdRef = useRef(0);

    const load = useCallback(() => {
        dispatch({ type: 'load' });
        post({ type: 'load' });
    }, [post]);

    const ready = state.status === 'ready';
    const route = useCallback(
        (text: string): Promise<RouteResult> => {
            if (!ready) {
                return Promise.reject(new Error('The local model is not ready.'));
            }
            const id = nextIdRef.current++;
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                post({ type: 'route', id, text, options: OPTIONS });
            });
        },
        [pending, post, ready]
    );

    return { ...state, load, route };
}

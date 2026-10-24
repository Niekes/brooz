import { describe, expect, it, vi } from 'vite-plus/test';
import type { OpenJev } from 'open-jev';
import { createModelHost } from '../../../src/renderer/shell/command/model-host';
import type { HostMessage } from '../../../src/renderer/shell/command/model-host';
import { rankedWidgets, routeIntent } from '../../../src/renderer/shell/command/route-intent';

const OPTIONS = {
    ids: ['weather', 'forecast'],
    descriptions: { weather: 'Current weather.', forecast: 'Multi-day forecast.' }
};

function fakeModel(decide = vi.fn()): OpenJev {
    return { runtime: { device: 'wasm', dtype: 'q4' }, decide } as unknown as OpenJev;
}

const answer = {
    widget: {
        choice: 'forecast',
        confidence: 0.8,
        probabilities: { weather: 0.2, forecast: 0.8 }
    }
};

describe('routing with the model', () => {
    it('asks one choice question over the routed tiles', async () => {
        const decide = vi.fn().mockResolvedValue(answer);
        const result = await routeIntent(fakeModel(decide), 'rain this weekend', OPTIONS);
        expect(decide).toHaveBeenCalledWith('rain this weekend', {
            widget: {
                type: 'choice',
                instructions: 'Which dashboard widget should handle this request?',
                options: OPTIONS.ids,
                descriptions: OPTIONS.descriptions
            }
        });
        expect(result).toMatchObject({
            widget: 'forecast',
            confidence: 0.8,
            probabilities: { weather: 0.2, forecast: 0.8 }
        });
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('ranks the most probable tiles first', () => {
        expect(rankedWidgets({ a: 0.1, b: 0.6, c: 0.3 }, 2)).toEqual([
            { widget: 'b', probability: 0.6 },
            { widget: 'c', probability: 0.3 }
        ]);
    });
});

describe('the model host', () => {
    function host(loadModel: (onProgress: (progress: number) => void) => Promise<OpenJev>) {
        const messages: HostMessage[] = [];
        return {
            messages,
            handle: createModelHost((message) => messages.push(message), loadModel)
        };
    }

    it('loads once, reports the progress in percent and the runtime', async () => {
        const loadModel = vi.fn((onProgress: (progress: number) => void) => {
            onProgress(0.256);
            return Promise.resolve(fakeModel());
        });
        const { messages, handle } = host(loadModel);
        await handle({ type: 'load' });
        await handle({ type: 'load' });
        expect(loadModel).toHaveBeenCalledTimes(1);
        expect(messages).toEqual([
            { type: 'progress', progress: 26 },
            { type: 'ready', runtime: { device: 'wasm', dtype: 'q4' } },
            { type: 'ready', runtime: { device: 'wasm', dtype: 'q4' } }
        ]);
    });

    it('reports a failed load and tries again on the next one', async () => {
        const loadModel = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockRejectedValueOnce('not an error')
            .mockResolvedValueOnce(fakeModel());
        const { messages, handle } = host(loadModel);
        await handle({ type: 'load' });
        await handle({ type: 'load' });
        await handle({ type: 'load' });
        expect(messages).toEqual([
            { type: 'load-error', message: 'offline' },
            { type: 'load-error', message: 'The local model could not be loaded.' },
            { type: 'ready', runtime: { device: 'wasm', dtype: 'q4' } }
        ]);
    });

    it('answers a route request by its id', async () => {
        const decide = vi.fn().mockResolvedValue(answer);
        const { messages, handle } = host(() => Promise.resolve(fakeModel(decide)));
        await handle({ type: 'load' });
        await handle({ type: 'route', id: 7, text: 'rain', options: OPTIONS });
        expect(messages[1]).toMatchObject({
            type: 'routed',
            id: 7,
            result: { widget: 'forecast', confidence: 0.8 }
        });
    });

    it('reports a failed route by its id', async () => {
        const decide = vi.fn().mockRejectedValueOnce(new Error('too long')).mockRejectedValue(42);
        const { messages, handle } = host(() => Promise.resolve(fakeModel(decide)));
        await handle({ type: 'load' });
        await handle({ type: 'route', id: 1, text: 'x', options: OPTIONS });
        await handle({ type: 'route', id: 2, text: 'x', options: OPTIONS });
        expect(messages.slice(1)).toEqual([
            { type: 'route-error', id: 1, message: 'too long' },
            { type: 'route-error', id: 2, message: 'The local model could not route that.' }
        ]);
    });
});

describe('the model worker', () => {
    it('serves the ONNX Runtime from the app and hands requests to the host', async () => {
        const load = vi.fn((options: { onProgress: (event: { progress: number }) => void }) => {
            options.onProgress({ progress: 0.5 });
            return Promise.resolve(fakeModel());
        });
        const env = {
            useWasmCache: true,
            backends: { onnx: { wasm: {} as Record<string, unknown> } }
        };
        vi.doMock('@huggingface/transformers', () => ({ env }));
        vi.doMock('open-jev', () => ({ OpenJev: { load } }));
        const posted: HostMessage[] = [];
        const scope = self as unknown as {
            postMessage: (message: HostMessage) => void;
            onmessage: ((event: { data: unknown }) => void) | null;
        };
        const postMessage = vi.spyOn(scope, 'postMessage').mockImplementation((message) => {
            posted.push(message);
        });

        await import('../../../src/renderer/shell/command/model-worker');

        expect(env.useWasmCache).toBe(false);
        expect(env.backends.onnx.wasm.wasmPaths).toEqual({
            mjs: expect.stringContaining('ort-wasm-simd-threaded.asyncify.mjs') as string,
            wasm: expect.stringContaining('ort-wasm-simd-threaded.asyncify.wasm') as string
        });

        scope.onmessage!({ data: { type: 'load' } });
        await vi.waitFor(() => expect(posted).toHaveLength(2));
        expect(load).toHaveBeenCalledWith(expect.objectContaining({ model: 'kev-0.6b' }));
        expect(posted).toEqual([
            { type: 'progress', progress: 50 },
            { type: 'ready', runtime: { device: 'wasm', dtype: 'q4' } }
        ]);

        postMessage.mockRestore();
        scope.onmessage = null;
        vi.doUnmock('@huggingface/transformers');
        vi.doUnmock('open-jev');
    });
});

import { env } from '@huggingface/transformers';
import { OpenJev } from 'open-jev';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import { createModelHost } from './model-host';
import type { HostMessage, HostRequest } from './model-host';

/**
 * The model worker: inference runs off the page thread, so the grid keeps
 * its frame rate while the model thinks. The ONNX Runtime files ship with
 * the app instead of coming from a CDN, and are loaded straight from the
 * app:// origin (no blob: copies), so the CSP stays at 'self'. The model
 * weights come from the Hugging Face hub and are cached by Transformers.js.
 */
env.useWasmCache = false;
env.backends.onnx.wasm!.wasmPaths = { mjs, wasm };

const scope = self as unknown as {
    postMessage(message: HostMessage): void;
    onmessage: ((event: MessageEvent<HostRequest>) => void) | null;
};

const host = createModelHost(
    (message) => scope.postMessage(message),
    (onProgress) =>
        OpenJev.load({ model: 'kev-0.6b', onProgress: ({ progress }) => onProgress(progress) })
);

scope.onmessage = (event) => void host(event.data);

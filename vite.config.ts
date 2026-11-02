import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';
import type { UserConfig } from 'vite-plus';

// Absolute paths, so nothing below depends on the working directory.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url));
const rendererOut = fileURLToPath(new URL('./dist/renderer', import.meta.url));
const mainOut = fileURLToPath(new URL('./dist/main', import.meta.url));
const preloadOut = fileURLToPath(new URL('./dist/preload', import.meta.url));
const mainEntry = fileURLToPath(new URL('./src/main/index.ts', import.meta.url));
const preloadEntry = fileURLToPath(new URL('./src/preload/index.ts', import.meta.url));
const srcRoot = fileURLToPath(new URL('./src', import.meta.url));
// The shadcn primitives are kept as generated (docs/adr/0004): they are not
// formatted or linted, only their app-* wrappers are.
const primitives = 'src/renderer/shell/ui/primitives/**';

// The import rules of the zones in .fallowrc.jsonc. Fallow enforces which
// zone may import which zone; oxlint enforces which package a zone may touch:
// shared, tiles and shell stay free of Electron and Node, the sandboxed
// preload may only use Electron.
const noElectron = {
    name: 'electron',
    message: 'this zone runs without Electron: only the main and preload zones may import it'
};
const noNodeBuiltins = {
    group: ['node:*'],
    message: 'this zone has no Node access: the main zone owns everything node:*'
};

// The renderer reaches these browser APIs through the hooks in
// shell/kit/browser.ts only (AGENTS.md, "Hooks"), so storage, media queries
// and location stay reactive and shared.
const kitHook = (hook: string): string => `use ${hook} from shell/kit/browser`;
const browserApis = [
    { name: 'localStorage', message: kitHook('useStoredValue') },
    { name: 'sessionStorage', message: kitHook('useStoredValue') },
    { name: 'matchMedia', message: kitHook('useMediaQuery') }
];
const browserApiProperties = [
    ...browserApis.map((global) => ({
        object: 'window',
        property: global.name,
        message: global.message
    })),
    {
        object: 'navigator',
        property: 'geolocation',
        message: kitHook('useGeolocation')
    }
];
// ahooks' storage hooks keep each call apart unless told to listen; every
// stored value goes through useStoredValue, which always does (docs/adr/0007).
const ahooksStorage = {
    name: 'ahooks',
    importNames: ['useLocalStorageState', 'useSessionStorageState'],
    message: kitHook('useStoredValue')
};
const kitBrowser = 'src/renderer/shell/kit/browser.ts';

const config: UserConfig = {
    fmt: {
        semi: true,
        singleQuote: true,
        printWidth: 100,
        trailingComma: 'none',
        tabWidth: 4
    },
    lint: {
        ignorePatterns: [primitives],
        jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
        rules: {
            'vite-plus/prefer-vite-plus-imports': 'error'
        },
        overrides: [
            {
                files: ['src/shared/**'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        { paths: [noElectron], patterns: [noNodeBuiltins] }
                    ]
                }
            },
            {
                files: ['src/renderer/**'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        { paths: [noElectron, ahooksStorage], patterns: [noNodeBuiltins] }
                    ],
                    'no-restricted-globals': ['error', ...browserApis],
                    'no-restricted-properties': ['error', ...browserApiProperties]
                }
            },
            {
                // The one module that wraps those APIs.
                files: [kitBrowser],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        { paths: [noElectron], patterns: [noNodeBuiltins] }
                    ],
                    'no-restricted-globals': 'off',
                    'no-restricted-properties': 'off'
                }
            },
            {
                files: ['src/preload/**'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            patterns: [
                                {
                                    ...noNodeBuiltins,
                                    message: 'the sandboxed preload has no Node access'
                                }
                            ]
                        }
                    ]
                }
            }
        ],
        options: { typeAware: true, typeCheck: true }
    },

    // The renderer: a plain Vite build served over the app:// protocol. The
    // Vite root is the renderer, so index.html lands at the root of the
    // output. Vitest runs from the repository root instead, because the
    // test suite and the coverage reach over all of src/.
    root: process.env.VITEST ? repoRoot : rendererRoot,
    base: './',
    plugins: [react(), tailwindcss()],
    // The `@/` alias the shadcn primitives import each other with.
    resolve: { alias: { '@': srcRoot } },
    build: {
        outDir: rendererOut,
        emptyOutDir: true
    },
    // The model worker imports the ONNX Runtime with dynamic imports, so it
    // is built as an ES module worker. Transformers.js and the runtime stay
    // out of the dev pre-bundle: they locate their .wasm and .mjs files by
    // URL, which pre-bundling would break.
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@huggingface/transformers', 'onnxruntime-web'] },

    // The Electron bundles. The main process is CJS, the preload must be CJS
    // because the sandboxed preload has no ESM loader. Both keep `electron`
    // external; the main bundle also keeps `electron-updater`, which ships as
    // a runtime dependency inside the asar archive.
    pack: [
        {
            entry: mainEntry,
            format: ['cjs'],
            outDir: mainOut,
            platform: 'node',
            deps: { neverBundle: ['electron', 'electron-updater'] },
            outputOptions: { entryFileNames: 'index.cjs' }
        },
        {
            entry: preloadEntry,
            format: ['cjs'],
            outDir: preloadOut,
            platform: 'node',
            deps: { neverBundle: ['electron'] },
            outputOptions: { entryFileNames: 'index.cjs' }
        }
    ],

    // Unit tests: the main, preload and shared zones run in Node with a
    // mocked `electron`, the renderer runs in jsdom with Testing Library.
    // Coverage is measured over both projects together: 100% everywhere,
    // because a fresh repository is the cheapest moment to hold that line.
    test: {
        globals: true,
        projects: [
            {
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['tests/{main,preload,shared}/**/*.test.ts']
                }
            },
            {
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['tests/renderer/**/*.test.{ts,tsx}']
                }
            }
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            include: ['src/**'],
            exclude: [
                '**/index.html',
                // The stylesheet is exercised by every renderer test, it has
                // no coverable code.
                '**/*.css',
                // The tile contract is types only: nothing to cover.
                'src/renderer/shell/tile.ts',
                // Vendored as generated; the app-* wrappers carry the coverage.
                primitives
            ],
            thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
        }
    }
};

export default defineConfig(config) as UserConfig;

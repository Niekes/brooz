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

const config: UserConfig = {
    fmt: {
        semi: true,
        singleQuote: true,
        printWidth: 100,
        trailingComma: 'none',
        tabWidth: 4
    },
    lint: {
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
                        { paths: [noElectron], patterns: [noNodeBuiltins] }
                    ]
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
    plugins: [react()],
    build: {
        outDir: rendererOut,
        emptyOutDir: true
    },

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
                    include: ['tests/renderer/**/*.test.tsx']
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
                'src/renderer/shell/tile.ts'
            ],
            thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
        }
    }
};

export default defineConfig(config) as UserConfig;

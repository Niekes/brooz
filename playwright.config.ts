import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/e2e',
    // The suite files are named *.e2e.ts.
    testMatch: '**/*.e2e.ts',
    // Electron is slow to boot, especially on CI runners.
    timeout: 60000,
    // The suite launches `electron .` from the repository root, it needs no
    // browser binaries.
    use: {
        trace: 'off'
    }
});

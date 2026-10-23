import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { _electron } from 'playwright';

const { version } = JSON.parse(
    // Playwright runs the suite from the repository root.
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as { version: string };

// The suite launches `electron .` against the build, not the packaged
// binary: Playwright drives the process over the inspector, which the
// packaged binary has fused away. A maintainer checks the packaged binary
// on the release draft.
test('the window opens and the about tile shows the app version', async () => {
    const app = await _electron.launch({ args: ['.'] });
    const window = await app.firstWindow();
    await expect(window.getByText(`brooz ${version}`)).toBeVisible();
    await app.close();
});

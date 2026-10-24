import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { _electron } from 'playwright';

const { version } = JSON.parse(
    // Playwright runs the suite from the repository root.
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as { version: string };

// The suite launches `electron .` against the build, not the packaged
// binary: Playwright drives the process over the inspector, which the
// packaged binary has fused away. A maintainer checks the packaged binary
// on the release draft.
let app: ElectronApplication;
let window: Page;
const violations: string[] = [];

test.beforeEach(async () => {
    violations.length = 0;
    app = await _electron.launch({ args: ['.'] });
    window = await app.firstWindow();
    window.on('console', (message) => {
        if (/Content.Security.Policy|Refused to/i.test(message.text())) {
            violations.push(message.text());
        }
    });
});

test.afterEach(async () => {
    await app.close();
});

test('the window opens and the about tile shows the app version', async () => {
    await expect(window.getByText(`Brooz ${version}`).first()).toBeVisible();
});

test('the dome fills the window with tiles', async () => {
    await expect(window.locator('[data-index]').first()).toBeVisible();
    expect(await window.locator('[data-index]').count()).toBeGreaterThanOrEqual(25);
});

test('the ask bar summons a live pomodoro without the network', async () => {
    const input = window.getByLabel('Ask your dashboard');
    await input.fill('start a 10 minute timer');
    await input.press('Enter');
    await expect(window.getByText('10 min')).toBeVisible();
    await expect(window.getByText('In focus')).toBeVisible();
});

test('the window is cross-origin isolated and breaks no policy', async () => {
    expect(await window.evaluate(() => crossOriginIsolated)).toBe(true);
    await expect(window.getByLabel('Ask your dashboard')).toBeVisible();
    expect(violations).toEqual([]);
});

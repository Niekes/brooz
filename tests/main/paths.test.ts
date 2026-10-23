import { describe, expect, it, vi } from 'vite-plus/test';
import { join } from 'node:path';
import { preloadPath, rendererRoot } from '../../src/main/paths';

const mockGetAppPath = vi.fn(() => '/app');

vi.mock('electron', () => ({
    app: {
        getAppPath: () => mockGetAppPath()
    }
}));

describe('the bundle paths', () => {
    it('resolves the renderer root below the app path', () => {
        expect(rendererRoot()).toBe(join('/app', 'dist', 'renderer'));
    });

    it('resolves the preload script below the app path', () => {
        expect(preloadPath()).toBe(join('/app', 'dist', 'preload', 'index.cjs'));
    });
});

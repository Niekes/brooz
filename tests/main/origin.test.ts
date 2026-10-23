import { describe, expect, it } from 'vite-plus/test';
import { isAppOrigin } from '../../src/main/origin';

describe('the app origin check', () => {
    it('accepts the app:// protocol', () => {
        expect(isAppOrigin('app://app/index.html')).toBe(true);
    });

    it('accepts the dev server while it is running', () => {
        expect(isAppOrigin('http://localhost:5173/', 'http://localhost:5173/')).toBe(true);
    });

    it('rejects a URL that is neither, even with a dev server', () => {
        expect(isAppOrigin('https://example.com', 'http://localhost:5173/')).toBe(false);
    });

    it('rejects everything when no dev server is running', () => {
        expect(isAppOrigin('http://localhost:5173/')).toBe(false);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { configureUpdater } from '../../src/main/updater';

const mockIsPackaged = vi.fn(() => false);
const mockOpenExternal = vi.fn((_url: unknown) => Promise.resolve(true));
const mockOn = vi.fn();
const mockCheckForUpdatesAndNotify = vi.fn();

vi.mock('electron', () => ({
    app: {
        get isPackaged() {
            return mockIsPackaged();
        }
    },
    shell: {
        openExternal: (url: unknown) => mockOpenExternal(url)
    }
}));

vi.mock('electron-updater', () => ({
    autoUpdater: {
        autoDownload: true,
        on: (...args: unknown[]) => mockOn(...args),
        checkForUpdatesAndNotify: (...args: unknown[]) => mockCheckForUpdatesAndNotify(...args)
    }
}));

function withPlatform(platform: 'darwin' | 'linux', run: () => void): void {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    try {
        run();
    } finally {
        Object.defineProperty(process, 'platform', { value: original, configurable: true });
    }
}

describe('the auto-updater', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsPackaged.mockReturnValue(false);
    });

    it('does nothing while the app is not packaged', () => {
        configureUpdater();
        expect(mockOn).not.toHaveBeenCalled();
        expect(mockCheckForUpdatesAndNotify).not.toHaveBeenCalled();
    });

    it('downloads and installs the update on Linux and Windows', () => {
        mockIsPackaged.mockReturnValue(true);
        withPlatform('linux', () => configureUpdater());
        expect(mockCheckForUpdatesAndNotify).toHaveBeenCalledTimes(1);
    });

    it('only points at the releases page on macOS while the app is unsigned', () => {
        mockIsPackaged.mockReturnValue(true);
        withPlatform('darwin', () => configureUpdater());
        expect(mockOn).toHaveBeenCalledTimes(1);
        const [event, listener] = mockOn.mock.calls[0] as [string, () => void];
        expect(event).toBe('update-available');
        listener();
        expect(mockOpenExternal).toHaveBeenCalledWith(
            'https://github.com/Niekes/brooz/releases/latest'
        );
        expect(mockCheckForUpdatesAndNotify).not.toHaveBeenCalled();
    });
});

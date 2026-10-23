import { describe, expect, it } from 'vite-plus/test';
import { IPC_CHANNELS, isIpcChannel } from '../../src/shared/ipc';

describe('the IPC contract', () => {
    it('names its channels as const', () => {
        expect(IPC_CHANNELS.appVersion).toBe('brooz:app-version');
    });

    it('accepts the channels of the contract', () => {
        expect(isIpcChannel(IPC_CHANNELS.appVersion)).toBe(true);
    });

    it('rejects everything else', () => {
        expect(isIpcChannel('brooz:not-a-channel')).toBe(false);
    });
});

import { describe, expect, it } from 'vite-plus/test';
import { IPC_CHANNELS, isIpcChannel } from '../../src/shared/ipc';

describe('the IPC contract', () => {
    it('names its channels as const', () => {
        expect(IPC_CHANNELS).toEqual({
            appVersion: 'brooz:app-version',
            geocode: 'brooz:geocode',
            weather: 'brooz:weather',
            airQuality: 'brooz:air-quality',
            keySet: 'brooz:key-set',
            keyDelete: 'brooz:key-delete',
            keyStatus: 'brooz:key-status',
            keyTest: 'brooz:key-test',
            stockQuotes: 'brooz:stock-quotes'
        });
    });

    it('accepts the channels of the contract', () => {
        for (const channel of Object.values(IPC_CHANNELS)) {
            expect(isIpcChannel(channel)).toBe(true);
        }
    });

    it('rejects everything else', () => {
        expect(isIpcChannel('brooz:not-a-channel')).toBe(false);
    });
});

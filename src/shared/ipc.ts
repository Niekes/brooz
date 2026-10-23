/**
 * The typed IPC contract between the main process and the renderer.
 *
 * This is the only file both sides import. A channel is added here first,
 * then handled in `src/main/ipc.ts`; the preload bridge is generic and needs
 * no change.
 */

export const IPC_CHANNELS = {
    appVersion: 'brooz:app-version'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** The arguments and the result of every channel. */
export interface IpcContract {
    [IPC_CHANNELS.appVersion]: {
        args: [];
        result: string;
    };
}

export type IpcArgs<Channel extends IpcChannel> = IpcContract[Channel]['args'];
export type IpcResult<Channel extends IpcChannel> = IpcContract[Channel]['result'];

/** The API the preload exposes on `window.brooz`. */
export interface BroozApi {
    invoke<Channel extends IpcChannel>(
        channel: Channel,
        ...args: IpcArgs<Channel>
    ): Promise<IpcResult<Channel>>;
}

declare global {
    interface Window {
        brooz: BroozApi;
    }
}

const channelNames: readonly string[] = Object.values(IPC_CHANNELS);

/** Whether `channel` is part of the contract. The preload rejects the rest. */
export function isIpcChannel(channel: string): channel is IpcChannel {
    return channelNames.includes(channel);
}

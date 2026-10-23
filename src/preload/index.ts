import { contextBridge, ipcRenderer } from 'electron';
import type { BroozApi } from '../shared/ipc';
import { isIpcChannel } from '../shared/ipc';
import type { IpcArgs, IpcChannel, IpcResult } from '../shared/ipc';

const brooz: BroozApi = {
    invoke<Channel extends IpcChannel>(
        channel: Channel,
        ...args: IpcArgs<Channel>
    ): Promise<IpcResult<Channel>> {
        const name: string = channel;
        if (!isIpcChannel(name)) {
            return Promise.reject(new Error(`Unknown IPC channel: ${name}`));
        }
        return ipcRenderer.invoke(name, ...args) as Promise<IpcResult<Channel>>;
    }
};

contextBridge.exposeInMainWorld('brooz', brooz);

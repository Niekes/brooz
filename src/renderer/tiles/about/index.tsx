import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import type { TileDefinition } from '../../shell/tile';

/**
 * The example tile: it shows the app version, which only the main process
 * knows. It walks the whole IPC path once - contract, preload bridge,
 * handler - and is the reference for every tile that follows.
 */
export function AboutTileBody(): JSX.Element {
    const [version, setVersion] = useState('unknown');

    useEffect(() => {
        let cancelled = false;
        void window.brooz.invoke(IPC_CHANNELS.appVersion).then((appVersion) => {
            if (!cancelled) {
                setVersion(appVersion);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="About" tag="DESKTOP" />
            <p className="flex min-h-0 flex-1 items-center text-2xl font-light text-white">
                Brooz {version}
            </p>
            <span className="text-[10px] tracking-[0.16em] text-white/40 uppercase">
                Small apps on a dome
            </span>
        </div>
    );
}

export const aboutTile: TileDefinition = {
    id: 'about',
    title: 'About',
    Component: AboutTileBody
};

import { setNonce } from 'get-nonce';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IPC_CHANNELS } from '../shared/ipc';
import { App } from './App';
import { migrateStoredNote } from './tiles/stickyNote';
import './styles.css';

function render(): void {
    // The one raw storage access: it rewrites what useLocalStorage cannot parse yet.
    // oxlint-disable-next-line no-restricted-globals
    migrateStoredNote(localStorage);
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}

// The CSP lets one style tag apply: the settings dialog's scroll lock, which
// carries this launch's nonce (src/main/protocol.ts). The shell renders once
// the nonce is set, so even a dialog opened at once carries it; without a
// nonce it renders anyway and the dialog merely logs a blocked style.
void window.brooz
    .invoke(IPC_CHANNELS.styleNonce)
    .then(setNonce, () => undefined)
    .then(render);

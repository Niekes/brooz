import { setNonce } from 'get-nonce';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IPC_CHANNELS } from '../shared/ipc';
import { App } from './App';
import './styles.css';

function render(): void {
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

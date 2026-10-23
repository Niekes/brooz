import type { JSX } from 'react';
import { tiles } from './tiles';

/**
 * The dashboard shell: a CSS grid, one cell per registered tile. Drag and
 * resize come later; a plain grid is enough to build tiles against.
 */
export function App(): JSX.Element {
    return (
        <main className="tile-grid">
            {tiles.map((tile) => (
                <section className="tile" key={tile.id}>
                    <h2>{tile.title}</h2>
                    <tile.Component />
                </section>
            ))}
        </main>
    );
}

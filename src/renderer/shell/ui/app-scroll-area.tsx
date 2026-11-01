import type { ComponentProps, JSX } from 'react';
import { ScrollArea } from './primitives/scroll-area';

/** The app's scroll container, with the thin overlay scrollbar. */
export function AppScrollArea(props: ComponentProps<typeof ScrollArea>): JSX.Element {
    return <ScrollArea {...props} />;
}

import type { ComponentProps, JSX } from 'react';
import { Separator } from './primitives/separator';

/** The app's separator: a hairline in the theme's border color (white/10). */
export function AppSeparator({ ...props }: ComponentProps<typeof Separator>): JSX.Element {
    return <Separator {...props} />;
}

import type { ComponentProps, JSX } from 'react';
import { Badge } from './primitives/badge';

/** The app's badge: a quiet outline pill unless told otherwise. */
export function AppBadge({
    variant = 'outline',
    ...props
}: ComponentProps<typeof Badge>): JSX.Element {
    return <Badge variant={variant} {...props} />;
}

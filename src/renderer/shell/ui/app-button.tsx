import type { ComponentProps, JSX } from 'react';
import { Button } from './primitives/button';

/** The app's button: shadcn's outline button in the glass tone, small by default. */
export function AppButton({
    variant = 'outline',
    size = 'sm',
    ...props
}: ComponentProps<typeof Button>): JSX.Element {
    return <Button variant={variant} size={size} {...props} />;
}

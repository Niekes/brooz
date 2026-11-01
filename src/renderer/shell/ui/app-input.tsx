import type { ComponentProps, JSX } from 'react';
import { Input } from './primitives/input';

/** The app's text input. */
export function AppInput(props: ComponentProps<typeof Input>): JSX.Element {
    return <Input {...props} />;
}

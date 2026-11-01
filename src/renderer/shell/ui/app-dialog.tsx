import type { JSX, ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './primitives/dialog';

/**
 * The app's dialog: a glass panel over the dome, with the title and the
 * description screen readers announce. Radix traps the focus and closes it
 * on Esc.
 */
export function AppDialog({
    open,
    onOpenChange,
    title,
    description,
    children
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    children: ReactNode;
}): JSX.Element {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[min(640px,88vh)] w-[min(960px,94vw)] max-w-none gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#0a0a0a]/85 p-0 text-white backdrop-blur-2xl sm:max-w-none">
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">{description}</DialogDescription>
                {children}
            </DialogContent>
        </Dialog>
    );
}

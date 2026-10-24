import type { JSX } from 'react';

/**
 * Charred Aqua: the painting behind the grid. It is fixed and first in the
 * shell, so the grid stage (fixed, later in the DOM) stacks above it while
 * its glass cards sample it through backdrop-filter. Pointer events stay
 * off, so the backdrop never swallows a drag or a wheel.
 *
 * Document order is stack order: the opaque base paints first, the
 * pattern, the glows and the vignette composite over it.
 */
export function Backdrop(): JSX.Element {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 isolate overflow-hidden"
        >
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(13deg, #e7eaea 0%, #97babf 14%, #4994a4 34%, #36555e 62%, #171c1f 76%, #060607 100%)'
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(113deg, transparent 0 8%, rgba(64, 178, 202, 0.28) 9%, transparent 11% 18%), repeating-linear-gradient(147deg, transparent 0 14%, rgba(212, 225, 226, 0.20) 15%, transparent 17% 28%), radial-gradient(ellipse at 74% 21%, rgba(23, 28, 31, 0.41), transparent 50%)',
                    filter: 'blur(12px)',
                    opacity: 0.3332
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse at 54% 3%, rgba(255,255,255,0.31), transparent 38%), radial-gradient(ellipse at 47% 34%, rgba(64, 178, 202, 0.30), transparent 42%)'
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at center, transparent 25%, rgba(0,0,0,0.19) 58%, rgba(0,0,0,0.85) 100%), linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.74) 100%)'
                }}
            />
        </div>
    );
}

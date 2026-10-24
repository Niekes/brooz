import type { JSX } from 'react';

export type CondName = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';

/** `cloud` is shared by every precipitation variant. */
const CLOUD_PATH = 'M7 18h9.5a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 6 10 4.2 4.2 0 0 0 7 18Z';

/** Hand-drawn stroke icons (24 viewBox), so the tiles need no icon dependency. */
export function ConditionIcon({
    name,
    className
}: {
    name: CondName;
    className?: string;
}): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-icon={name}
            className={className}
        >
            {name === 'sun' && (
                <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
                </>
            )}
            {name !== 'sun' && <path d={CLOUD_PATH} />}
            {name === 'rain' && <path d="M8.5 20.5 7.8 22.5M12 21l-.7 2M15.5 20.5l-.7 2" />}
            {name === 'snow' && (
                <path d="M9.3 20.6v2.4M8.1 21.8h2.4M12 21.4v2.2M10.9 22.5h2.2M14.7 20.6v2.4M13.5 21.8h2.4" />
            )}
            {name === 'storm' && <path d="M12.4 18.4 10.4 21.4h2.8l-1.5 1.8" />}
        </svg>
    );
}

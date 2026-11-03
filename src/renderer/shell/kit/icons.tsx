import type { ComponentType, JSX } from 'react';
import type { ProviderId } from '../../../shared/providers';

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

/** The svg shell every provider mark shares; the colors are the providers' own. */
function BrandSvg({
    id,
    viewBox,
    className,
    fill = 'none',
    stroke,
    strokeWidth,
    children
}: {
    id: ProviderId;
    viewBox: string;
    className?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    children: JSX.Element | readonly JSX.Element[];
}): JSX.Element {
    return (
        <svg
            viewBox={viewBox}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-icon={id}
            className={className}
        >
            {children}
        </svg>
    );
}

/** OpenWeatherMap's mark: wind strokes in the brand's orange. */
function OpenWeatherMapIcon({ className }: { className?: string }): JSX.Element {
    return (
        <BrandSvg
            id="openweathermap"
            viewBox="0 0 50.8 50.8"
            stroke="#e46b4a"
            strokeWidth={3.175}
            className={className}
        >
            <path d="M7.859 29.266a14.95 14.95 0 0 1 5.864-16.112 14.95 14.95 0 0 1 17.147 0 14.95 14.95 0 0 1 5.865 16.112m-8.266 0h14.129m-37.298 0h4.487m.003 5.594h8.943m15.398 0h2.514m5.3 0h2.514m-31.771 5.594h23.757m-9.294-5.594h1.844M9.79 29.266a2.797 2.797 0 0 1 2.797 2.798A2.797 2.797 0 0 1 9.79 34.86m8.943 0a2.797 2.797 0 0 1 2.798 2.798 2.797 2.797 0 0 1-2.798 2.797m8.418 0a2.8 2.8 0 0 1-2.422-1.398 2.8 2.8 0 0 1 0-2.797 2.8 2.8 0 0 1 2.422-1.4" />
            <path d="M28.47 34.86a2.8 2.8 0 0 1-2.422-1.398 2.8 2.8 0 0 1 0-2.797 2.8 2.8 0 0 1 2.423-1.399" />
        </BrandSvg>
    );
}

/**
 * Stormglass's mark: a wind glyph, lightened from the brand's navy to a
 * seafoam so it reads on the dark glass.
 */
function StormglassIcon({ className }: { className?: string }): JSX.Element {
    return (
        <BrandSvg id="stormglass" viewBox="0 0 31 31" fill="#5eead4" className={className}>
            <path d="M12.564 1.486c.935 0 1.692.753 1.692 1.682v9.452L22.42 7.89a1.67 1.67 0 0 1 2.29.604c.46.8.18 1.826-.624 2.292l-8.182 4.739 8.182 4.74a1.683 1.683 0 0 1 .624 2.29 1.67 1.67 0 0 1-2.29.604l-8.163-4.728v9.4c0 .929-.757 1.682-1.692 1.682a1.687 1.687 0 0 1-1.692-1.682V18.44l-8.15 4.72a1.67 1.67 0 0 1-2.289-.603c-.46-.8-.18-1.826.624-2.292l8.182-4.74-8.182-4.738a1.683 1.683 0 0 1-.624-2.292 1.67 1.67 0 0 1 2.29-.604l8.149 4.72V3.169c0-.929.757-1.682 1.692-1.682" />
        </BrandSvg>
    );
}

/** Finnhub's mark: the brand's green gradient wordmark glyph. */
function FinnhubIcon({ className }: { className?: string }): JSX.Element {
    return (
        <BrandSvg id="finnhub" viewBox="40 94 656 420" className={className}>
            <defs>
                <linearGradient id="finnhub-a" x1="136" x2="693" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6db530" />
                    <stop offset="1" stopColor="#3dac58" />
                </linearGradient>
                <linearGradient id="finnhub-c">
                    <stop offset="0" stopColor="#6db530" />
                    <stop offset="1" stopColor="#3dac58" />
                </linearGradient>
                <mask id="finnhub-b">
                    <path fill="#fff" d="M40 94h656v420H40z" />
                    <rect width="341" height="104" x="26" y="267" rx="52" />
                    <rect width="229" height="92" x="26" y="362" rx="46" />
                </mask>
            </defs>
            <g fill="url(#finnhub-a)" mask="url(#finnhub-b)">
                <ellipse cx="334" cy="277" rx="198" ry="181" />
                <path d="M180 222h372.5v281H180z" />
                <circle cx="552.5" cy="362.5" r="140.5" />
            </g>
            <g fill="url(#finnhub-c)">
                <rect width="309" height="72" x="42" y="283" rx="36" />
                <rect width="197" height="60" x="42" y="378" rx="30" />
                <rect width="109" height="55" x="46" y="456" rx="27.5" />
            </g>
        </BrandSvg>
    );
}

/** Every provider's mark, keyed by provider id. */
const PROVIDER_ICONS: Record<ProviderId, ComponentType<{ className?: string }>> = {
    openweathermap: OpenWeatherMapIcon,
    stormglass: StormglassIcon,
    finnhub: FinnhubIcon
};

/**
 * A provider's mark in the settings, in the provider's brand color.
 * Hand-kept, so the app needs no icon dependency for three glyphs.
 */
export function ProviderIcon({
    id,
    className
}: {
    id: ProviderId;
    className?: string;
}): JSX.Element {
    const Icon = PROVIDER_ICONS[id];
    return <Icon className={className} />;
}

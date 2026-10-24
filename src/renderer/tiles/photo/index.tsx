import type { JSX } from 'react';
import { HUES, pick } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

/**
 * Full-bleed procedural "album art": a seeded hue at seeded angles, a
 * neutral white highlight and a black vignette, so the tile stays one hue.
 */
export function Photo({ seed }: TileProps): JSX.Element {
    const hue = pick(seed, HUES);
    const baseAngle = 100 + ((seed * 37) % 160);
    const hx = 20 + ((seed * 53) % 60);
    const hy = 15 + ((seed * 71) % 50);

    const background = [
        `radial-gradient(120% 85% at ${hx}% ${hy}%, rgba(255,255,255,0.26), rgba(255,255,255,0) 55%)`,
        `linear-gradient(${baseAngle + 175}deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.45) 100%)`,
        `linear-gradient(${baseAngle}deg, ${hue.hex}, ${hue.hex}66)`
    ].join(', ');

    return (
        <div
            aria-hidden="true"
            data-testid="photo"
            className="absolute inset-0"
            style={{ background }}
        />
    );
}

export const photoTile: TileDefinition = {
    id: 'photo-tile',
    title: 'Photo',
    Component: Photo,
    route: {
        description: 'Show a photo or picture for a search term.',
        keywords: ['photo', 'picture', 'image', 'show me a photo'],
        examples: ['show me a photo of mountains', 'find a picture of the ocean'],
        pattern: /\b(?:photos?|pictures?|images?)\b/,
        weight: 3,
        args: ({ query }) => ({ query })
    }
};

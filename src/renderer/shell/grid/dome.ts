/**
 * The geometry of the infinite grid: a finite pool of tiles wraps around
 * the viewport, and every tile sits on a sphere ("dome") seen from inside
 * or outside. Everything here is pure math; the engine owns the state.
 */

/** Viewpoint side of the dome: -1 = inside the globe, +1 = outside. */
export type DomeSide = -1 | 1;

export interface DomePreset {
    /** -1 renders from inside the globe (rim tiles warp toward you), +1 from outside. */
    side: DomeSide;
    /** Dome radius as a fraction of the larger viewport axis. */
    radiusScale: number;
    /** Closest approach toward the camera, as a fraction of PERSPECTIVE. */
    nearZFraction: number;
    /** Tile tilt multiplier: 1 is the geometric truth, lower softens the warp. */
    rotationScale: number;
    /** Rim vignette: 0 = none, 1 = rim tiles fade to nothing. */
    edgeFade: number;
}

/**
 * Named dome dials. A preset answers one question: how curved is the dome?
 * PERSPECTIVE and MIN_RADIUS are shared by every preset, so presets stay
 * comparable.
 */
export const DOME_PRESETS = {
    /** Inside the globe, the original tuning. */
    current: { side: -1, radiusScale: 0.85, nearZFraction: 0.45, rotationScale: 1, edgeFade: 0.45 },
    /** Soft warp: less tilt, lighter vignette. */
    gentle: {
        side: -1,
        radiusScale: 0.85,
        nearZFraction: 0.45,
        rotationScale: 0.6,
        edgeFade: 0.25
    },
    /** More enclosing: larger radius, rim tiles come closer to the camera. */
    deep: { side: -1, radiusScale: 1.0, nearZFraction: 0.55, rotationScale: 1, edgeFade: 0.45 },
    /** The convex outside view, kept as a comparison reference. */
    outside: { side: 1, radiusScale: 0.85, nearZFraction: 0.45, rotationScale: 1, edgeFade: 0.45 }
} satisfies Record<string, DomePreset>;

/** Camera distance in px, also the scale reference for depth. */
export const PERSPECTIVE = 1200;
/** Smallest dome radius, in px. */
const MIN_RADIUS = 1700;
const GAP = 34;
/**
 * Tile area is held constant regardless of orientation, so a 16:9 tile
 * reads at the same visual weight as the old 260x330 portrait tiles.
 */
const CARD_AREA = 260 * 330;
const TILE_ASPECT = 16 / 9;
const RAD_TO_DEG = 180 / Math.PI;
/** The smallest pool, in tiles per axis. */
const MIN_POOL = 5;

export interface Sizes {
    cardW: number;
    cardH: number;
    cellW: number;
    cellH: number;
}

export interface Pool {
    cols: number;
    rows: number;
}

export interface Point {
    x: number;
    y: number;
}

/** Card and cell dimensions, fixed by the tile aspect ratio. */
export const SIZES: Sizes = (() => {
    const cardH = Math.sqrt(CARD_AREA / TILE_ASPECT);
    const cardW = TILE_ASPECT * cardH;
    return { cardW, cardH, cellW: cardW + GAP, cellH: cardH + GAP };
})();

/** Wraps v into [-size/2, size/2). */
export function wrap(v: number, size: number): number {
    return ((((v + size / 2) % size) + size) % size) - size / 2;
}

/** The pool covers the viewport plus one spare tile on every side. */
export function poolFor(width: number, height: number): Pool {
    return {
        cols: Math.max(MIN_POOL, Math.ceil(width / SIZES.cellW) + 2),
        rows: Math.max(MIN_POOL, Math.ceil(height / SIZES.cellH) + 2)
    };
}

/**
 * Which tile definition a slot shows: a horizontal step moves the index by
 * 3 and a vertical step by 5, so orthogonal neighbours never match as long
 * as neither divides the tile count.
 */
export function tileIndexAt(slot: number, pool: Pool, count: number): number | null {
    if (!Number.isInteger(slot) || slot < 0 || slot >= pool.cols * pool.rows) {
        return null;
    }
    const row = Math.floor(slot / pool.cols);
    const col = slot % pool.cols;
    return (row * 5 + col * 3) % count;
}

/** The seed of a slot's mock data. */
export function seedAt(slot: number, pool: Pool): number {
    const row = Math.floor(slot / pool.cols);
    const col = slot % pool.cols;
    return (row * 31 + col * 17) % 1000;
}

/**
 * The center of a slot relative to the viewport center, wrapped, so cards
 * leaving one edge reappear at the other.
 */
export function slotOffset(slot: number, pool: Pool, pan: Point): Point {
    const row = Math.floor(slot / pool.cols);
    const col = slot % pool.cols;
    return {
        x: wrap(col * SIZES.cellW + pan.x + SIZES.cellW / 2, pool.cols * SIZES.cellW),
        y: wrap(row * SIZES.cellH + pan.y + SIZES.cellH / 2, pool.rows * SIZES.cellH)
    };
}

export interface DomeShape {
    /** Sphere radius in px. */
    radius: number;
    /** Uniform softening that keeps the nearest tile clear of the camera. */
    softening: number;
}

/**
 * The sphere for a viewport. It scales with the viewport, so wide screens
 * never wrap past it. Inside the globe, the pool corner's sagitta can exceed
 * the perspective distance on wide viewports (a tile past it flips behind
 * the camera); the whole dome is then softened by the same factor, which
 * keeps the curve smooth.
 */
export function domeShape(
    pool: Pool,
    width: number,
    height: number,
    preset: DomePreset
): DomeShape {
    const radius = Math.max(MIN_RADIUS, width * preset.radiusScale, height * preset.radiusScale);
    if (preset.side > 0) {
        return { radius, softening: 1 };
    }
    const halfW = (pool.cols * SIZES.cellW) / 2;
    const halfH = (pool.rows * SIZES.cellH) / 2;
    const sagitta =
        radius - Math.sqrt(Math.max(radius * radius - halfW * halfW - halfH * halfH, 0));
    const maxNearZ = PERSPECTIVE * preset.nearZFraction;
    return { radius, softening: sagitta > maxNearZ ? maxNearZ / sagitta : 1 };
}

function clampedAsin(value: number): number {
    return Math.asin(Math.max(-1, Math.min(1, value)));
}

/**
 * The transform and opacity of one card on the dome. With side = -1 the
 * dome is concave around the viewer: rim tiles advance toward the camera
 * and their outer edges swing inward instead of receding.
 */
export function placeOnDome(
    offset: Point,
    center: Point,
    shape: DomeShape,
    preset: DomePreset
): { transform: string; opacity: number } {
    const { x: dx, y: dy } = offset;
    const { radius } = shape;
    const d2 = dx * dx + dy * dy;
    const sagitta = radius - Math.sqrt(Math.max(radius * radius - d2, 0));
    const z = preset.side * -sagitta * shape.softening;
    const tilt = preset.side * RAD_TO_DEG * preset.rotationScale;
    const rotY = tilt * clampedAsin(dx / radius);
    const rotX = -tilt * clampedAsin(dy / radius);
    return {
        transform: `translate3d(${center.x + dx}px, ${center.y + dy}px, ${z}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
        opacity: Math.max(0, 1 - (d2 / (radius * radius)) * preset.edgeFade)
    };
}

/** The flat grid for reduced motion: no depth, no tilt, no fade. */
export function placeFlat(offset: Point, center: Point): string {
    return `translate3d(${center.x + offset.x}px, ${center.y + offset.y}px, 0)`;
}

/** The slot closest to the viewport center among those that match. */
export function nearestSlot(
    pool: Pool,
    pan: Point,
    matches: (slot: number) => boolean
): number | null {
    let best: number | null = null;
    let bestDistance = Infinity;
    for (let slot = 0; slot < pool.cols * pool.rows; slot++) {
        if (!matches(slot)) {
            continue;
        }
        const { x, y } = slotOffset(slot, pool, pan);
        const distance = x * x + y * y;
        if (distance < bestDistance) {
            best = slot;
            bestDistance = distance;
        }
    }
    return best;
}

/** The pan that puts a slot in the middle of the viewport. */
export function panToCenter(slot: number, pool: Pool, pan: Point): Point {
    const { x, y } = slotOffset(slot, pool, pan);
    return { x: pan.x - x, y: pan.y - y };
}

export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

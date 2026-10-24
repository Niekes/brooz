import { describe, expect, it } from 'vite-plus/test';
import {
    DOME_PRESETS,
    SIZES,
    domeShape,
    easeOutCubic,
    nearestSlot,
    panToCenter,
    placeFlat,
    placeOnDome,
    poolFor,
    seedAt,
    slotOffset,
    tileIndexAt,
    wrap
} from '../../src/renderer/shell/grid/dome';

const pool = { cols: 7, rows: 5 };
const origin = { x: 0, y: 0 };

describe('the dome geometry', () => {
    it('keeps the tile area of the old portrait tiles at 16:9', () => {
        expect(SIZES.cardW / SIZES.cardH).toBeCloseTo(16 / 9);
        expect(SIZES.cardW * SIZES.cardH).toBeCloseTo(260 * 330);
        expect(SIZES.cellW - SIZES.cardW).toBe(34);
    });

    it('wraps into a centered window', () => {
        expect(wrap(0, 10)).toBe(0);
        expect(wrap(6, 10)).toBe(-4);
        expect(wrap(-6, 10)).toBe(4);
        expect(wrap(5, 10)).toBe(-5);
    });

    it('covers the viewport with a spare tile on every side, never fewer than five', () => {
        expect(poolFor(0, 0)).toEqual({ cols: 5, rows: 5 });
        const big = poolFor(4000, 3000);
        expect(big.cols).toBe(Math.ceil(4000 / SIZES.cellW) + 2);
        expect(big.rows).toBe(Math.ceil(3000 / SIZES.cellH) + 2);
    });

    it('places tiles so that orthogonal neighbours never match', () => {
        expect(tileIndexAt(0, pool, 15)).toBe(0);
        expect(tileIndexAt(1, pool, 15)).toBe(3);
        expect(tileIndexAt(7, pool, 15)).toBe(5);
        for (let slot = 0; slot < 35; slot++) {
            const kind = tileIndexAt(slot, pool, 15);
            if (slot % 7 < 6) {
                expect(tileIndexAt(slot + 1, pool, 15)).not.toBe(kind);
            }
            if (slot < 28) {
                expect(tileIndexAt(slot + 7, pool, 15)).not.toBe(kind);
            }
        }
    });

    it('knows no tile outside the pool', () => {
        expect(tileIndexAt(-1, pool, 15)).toBe(null);
        expect(tileIndexAt(35, pool, 15)).toBe(null);
        expect(tileIndexAt(1.5, pool, 15)).toBe(null);
    });

    it('seeds every slot from its position', () => {
        expect(seedAt(0, pool)).toBe(0);
        expect(seedAt(8, pool)).toBe(48);
    });

    it('measures a slot from the viewport center, wrapped', () => {
        const first = slotOffset(0, pool, origin);
        expect(first.x).toBeCloseTo(SIZES.cellW / 2);
        expect(first.y).toBeCloseTo(SIZES.cellH / 2);
        const far = slotOffset(6, pool, origin);
        expect(far.x).toBeLessThan(0);
    });

    it('pans a slot into the middle', () => {
        const to = panToCenter(8, pool, { x: 10, y: 20 });
        const centered = slotOffset(8, pool, to);
        expect(centered.x).toBeCloseTo(0);
        expect(centered.y).toBeCloseTo(0);
    });

    it('finds the matching slot nearest the center', () => {
        const onFirst = { x: -SIZES.cellW / 2, y: -SIZES.cellH / 2 };
        expect(nearestSlot(pool, onFirst, () => true)).toBe(0);
        expect(nearestSlot(pool, origin, (slot) => slot === 20)).toBe(20);
        expect(nearestSlot(pool, origin, () => false)).toBe(null);
    });

    it('eases out', () => {
        expect(easeOutCubic(0)).toBe(0);
        expect(easeOutCubic(1)).toBe(1);
        expect(easeOutCubic(0.5)).toBe(0.875);
    });
});

describe('the dome', () => {
    it('grows with the viewport, never below its minimum', () => {
        expect(domeShape(pool, 800, 600, DOME_PRESETS.current).radius).toBe(1700);
        expect(domeShape(pool, 4000, 600, DOME_PRESETS.current).radius).toBe(3400);
    });

    it('softens an interior dome that would reach past the camera', () => {
        const wide = poolFor(6000, 4000);
        const shape = domeShape(wide, 6000, 4000, DOME_PRESETS.deep);
        expect(shape.softening).toBeLessThan(1);
        expect(domeShape({ cols: 1, rows: 1 }, 800, 600, DOME_PRESETS.current).softening).toBe(1);
    });

    it('never softens the outside view', () => {
        const wide = poolFor(6000, 4000);
        expect(domeShape(wide, 6000, 4000, DOME_PRESETS.outside).softening).toBe(1);
    });

    it('pulls rim tiles toward the camera from inside, pushes them away from outside', () => {
        const shape = { radius: 1700, softening: 1 };
        const center = { x: 400, y: 300 };
        const rim = { x: 600, y: -300 };
        const inside = placeOnDome(rim, center, shape, DOME_PRESETS.current);
        const outside = placeOnDome(rim, center, shape, DOME_PRESETS.outside);
        expect(inside.transform).toMatch(/^translate3d\(1000px, 0px, \d/);
        expect(outside.transform).toMatch(/^translate3d\(1000px, 0px, -\d/);
        expect(inside.opacity).toBeLessThan(1);
        expect(placeOnDome(origin, center, shape, DOME_PRESETS.current)).toEqual({
            transform: 'translate3d(400px, 300px, 0px) rotateY(0deg) rotateX(0deg)',
            opacity: 1
        });
    });

    it('clamps a tile beyond the sphere', () => {
        const shape = { radius: 100, softening: 1 };
        const placed = placeOnDome({ x: 500, y: -500 }, origin, shape, DOME_PRESETS.outside);
        expect(placed.transform).toContain('rotateY(90deg) rotateX(90deg)');
        expect(placed.opacity).toBe(0);
    });

    it('lays tiles flat for reduced motion', () => {
        expect(placeFlat({ x: 5, y: 6 }, { x: 10, y: 20 })).toBe('translate3d(15px, 26px, 0)');
    });
});

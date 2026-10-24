import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { DOME_PRESETS, SIZES } from '../../src/renderer/shell/grid/dome';
import { DomeEngine } from '../../src/renderer/shell/grid/engine';
import { stubMatchMedia } from './stubs';

let frames: FrameRequestCallback[] = [];
const cancelFrame = vi.fn();
let now = 0;

/** Runs the pending animation frame, `ms` after the last one. */
function step(ms = 1000 / 60): void {
    now += ms;
    const pending = frames;
    frames = [];
    for (const frame of pending) {
        frame(now);
    }
}

/** Runs frames until the loop goes idle. */
function settle(): number {
    let count = 0;
    while (frames.length > 0 && count < 2000) {
        step();
        count++;
    }
    return count;
}

function pointer(type: string, x: number, y: number): Event {
    return Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: 1 });
}

function wheel(deltaX: number, deltaY: number): Event {
    return Object.assign(new Event('wheel', { cancelable: true }), { deltaX, deltaY });
}

/** The numbers of a transform, rounded, so float noise does not matter. */
function numbers(transform: string): number[] {
    return (transform.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(
        (n) => Math.round(Number(n) * 100) / 100 + 0
    );
}

function setup(reduced = false) {
    const motion = stubMatchMedia(reduced);
    const onPool = vi.fn();
    const onInteract = vi.fn();
    const engine = new DomeEngine(DOME_PRESETS.current, onPool, onInteract);
    const stage = document.createElement('div');
    let captured = false;
    const capture = {
        setPointerCapture: vi.fn(() => (captured = true)),
        hasPointerCapture: vi.fn(() => captured),
        releasePointerCapture: vi.fn(() => (captured = false))
    };
    Object.assign(stage, capture);
    const card = document.createElement('div');
    engine.setCard(0, card);
    const detach = engine.attach(stage);
    return { engine, stage, card, onPool, onInteract, detach, motion, capture };
}

describe('the dome engine', () => {
    beforeEach(() => {
        frames = [];
        now = 0;
        vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
            frames.push(frame);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', cancelFrame);
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        window.innerWidth = 1024;
        window.innerHeight = 768;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('sizes the pool to the viewport and places the cards on the dome', () => {
        const { card, onPool } = setup();
        expect(onPool).toHaveBeenCalledWith({ cols: 5, rows: 6 });
        step();
        expect(card.style.transform).toMatch(/^translate3d\(.*rotateY\(.*deg\) rotateX\(.*deg\)$/);
        expect(Number(card.style.opacity)).toBeGreaterThan(0);
        expect(frames).toHaveLength(0);
    });

    it('re-pools on a resize that changes it, and only then', () => {
        const { onPool } = setup();
        window.innerWidth = 1030;
        window.dispatchEvent(new Event('resize'));
        expect(onPool).toHaveBeenCalledTimes(1);
        window.innerWidth = 3000;
        window.dispatchEvent(new Event('resize'));
        expect(onPool).toHaveBeenCalledTimes(2);
    });

    it('drags, glides and comes to rest', () => {
        const { stage, card, onInteract, capture } = setup();
        step();
        const before = card.style.transform;

        stage.dispatchEvent(pointer('pointerdown', 100, 100));
        expect(stage.classList.contains('dragging')).toBe(true);
        expect(capture.setPointerCapture).toHaveBeenCalledWith(1);
        stage.dispatchEvent(pointer('pointermove', 140, 120));
        step();
        expect(card.style.transform).not.toBe(before);
        stage.dispatchEvent(pointer('pointerup', 140, 120));
        expect(stage.classList.contains('dragging')).toBe(false);
        expect(capture.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(onInteract).toHaveBeenCalled();

        const glide = card.style.transform;
        expect(settle()).toBeGreaterThan(10);
        expect(card.style.transform).not.toBe(glide);
    });

    it('ignores a move without a press and a release without a drag', () => {
        const { stage, onInteract, capture } = setup();
        stage.dispatchEvent(pointer('pointermove', 10, 10));
        stage.dispatchEvent(pointer('pointercancel', 10, 10));
        expect(onInteract).not.toHaveBeenCalled();
        expect(capture.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('lets go of a pointer it never captured', () => {
        const { stage, capture } = setup();
        stage.dispatchEvent(pointer('pointerdown', 0, 0));
        capture.releasePointerCapture();
        stage.dispatchEvent(pointer('pointercancel', 0, 0));
        expect(capture.releasePointerCapture).toHaveBeenCalledTimes(1);
    });

    it('pans with the wheel and keeps the page from scrolling', () => {
        const { stage, card } = setup();
        step();
        const before = card.style.transform;
        const event = wheel(0, 50);
        stage.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        settle();
        expect(card.style.transform).not.toBe(before);
    });

    it('flies a slot to the center and stops there', () => {
        const { engine, card } = setup();
        settle();
        const slot = engine.nearest((candidate) => candidate === 7)!;
        expect(slot).toBe(7);
        const other = document.createElement('div');
        engine.setCard(7, other);
        engine.centerOn(7);
        step(200);
        step(250);
        expect(frames).toHaveLength(0);
        expect(numbers(other.style.transform)).toEqual([3, 512, 384, 0, 0, 0]);
        expect(Number(other.style.opacity)).toBeGreaterThan(0.99);
        expect(card.style.transform).not.toBe(other.style.transform);
    });

    it('stops a flight when the person grabs the grid', () => {
        const { engine, stage, onInteract } = setup();
        engine.centerOn(7);
        step(100);
        stage.dispatchEvent(pointer('pointerdown', 0, 0));
        expect(onInteract).toHaveBeenCalled();
        stage.dispatchEvent(pointer('pointerup', 0, 0));
        settle();
    });

    it('lays the grid flat and jumps instead of flying for reduced motion', () => {
        const { engine, card, stage, motion } = setup(true);
        step();
        expect(numbers(card.style.transform)).toEqual(
            numbers(`translate3d(${512 + SIZES.cellW / 2}px, ${384 + SIZES.cellH / 2}px, 0)`)
        );
        expect(Number(card.style.opacity)).toBe(1);

        stage.dispatchEvent(pointer('pointerdown', 0, 0));
        stage.dispatchEvent(pointer('pointermove', 30, 0));
        stage.dispatchEvent(pointer('pointerup', 30, 0));
        settle();

        engine.centerOn(0);
        step();
        expect(numbers(card.style.transform)).toEqual([3, 512, 384, 0]);
        expect(frames).toHaveLength(0);

        motion.set(false);
        step();
        expect(card.style.transform).toContain('rotateY');
    });

    it('skips a frame that would draw the same picture', () => {
        const { stage, card } = setup();
        step();
        card.style.transform = 'scale(2)';
        stage.dispatchEvent(wheel(0, 0));
        step();
        expect(card.style.transform).toBe('scale(2)');
    });

    it('skips a slot without a card', () => {
        const { engine, card } = setup();
        engine.setCard(3, null);
        step();
        expect(card.style.transform).toContain('translate3d');
    });

    it('does not rewrite an opacity that barely changed', () => {
        const { stage, card } = setup();
        step();
        card.style.opacity = '0.123';
        stage.dispatchEvent(wheel(0.001, 0));
        step();
        expect(card.style.opacity).toBe('0.123');
    });

    it('detaches its listeners and its pending frame', () => {
        const { stage, detach, onInteract } = setup();
        cancelFrame.mockClear();
        detach();
        expect(cancelFrame).toHaveBeenCalled();
        stage.dispatchEvent(pointer('pointerdown', 0, 0));
        expect(onInteract).not.toHaveBeenCalled();
        detach();
        expect(cancelFrame).toHaveBeenCalledTimes(1);
    });
});

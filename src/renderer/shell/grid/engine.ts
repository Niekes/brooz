import {
    domeShape,
    easeOutCubic,
    nearestSlot,
    panToCenter,
    placeFlat,
    placeOnDome,
    poolFor,
    slotOffset
} from './dome';
import type { DomePreset, Point, Pool } from './dome';

const FRICTION = 0.94;
/** Below this speed (px per 60Hz tick) the glide stops. */
const REST_SPEED = 0.05;
const CENTER_DURATION = 400;

interface CenterAnimation {
    from: Point;
    to: Point;
    t0: number;
}

/**
 * The motion of the infinite grid: drag, wheel and glide, the fly-to-tile
 * animation, and the per-frame write of every card's transform and opacity.
 *
 * Everything the animation loop reads lives on the engine, not in React
 * state, so dragging never re-renders a tile. The loop only runs while
 * something moves; a frame that would draw the same picture as the last one
 * skips the style writes.
 */
export class DomeEngine {
    private pool: Pool = { cols: 0, rows: 0 };
    private readonly pan: Point = { x: 0, y: 0 };
    private velocity: Point = { x: 0, y: 0 };
    private drag: { active: boolean; x: number; y: number } = { active: false, x: 0, y: 0 };
    private center: CenterAnimation | null = null;
    private flat = false;
    private viewport = { w: 0, h: 0 };
    private readonly cards: Array<HTMLElement | null> = [];
    /** The last opacity written per card, so unchanged values are skipped. */
    private opacities = new Float32Array(0);
    private raf: number | null = null;
    private lastTime = 0;
    private lastDrawn = '';

    constructor(
        private readonly preset: DomePreset,
        private readonly onPool: (pool: Pool) => void,
        private readonly onInteract: () => void
    ) {}

    /** Called by the tiles' ref callback as cards mount and unmount. */
    setCard(slot: number, card: HTMLElement | null): void {
        this.cards[slot] = card;
        this.invalidate();
    }

    /** The slot closest to the viewport center among those that match. */
    nearest(matches: (slot: number) => boolean): number | null {
        return nearestSlot(this.pool, this.pan, matches);
    }

    /** Flies the grid until the slot sits in the middle of the viewport. */
    centerOn(slot: number): void {
        const to = panToCenter(slot, this.pool, this.pan);
        this.velocity = { x: 0, y: 0 };
        if (this.flat) {
            this.center = null;
            Object.assign(this.pan, to);
        } else {
            this.center = { from: { ...this.pan }, to, t0: performance.now() };
        }
        this.invalidate();
    }

    /** Wires the engine to the stage element; the returned function undoes it. */
    attach(stage: HTMLElement): () => void {
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onMotion = (): void => {
            this.flat = motion.matches;
            this.invalidate();
        };
        const onResize = (): void => this.resize(window.innerWidth, window.innerHeight);

        const listeners: Array<
            [EventTarget, string, (event: never) => void, AddEventListenerOptions?]
        > = [
            [stage, 'pointerdown', (event: PointerEvent) => this.pointerDown(stage, event)],
            [stage, 'pointermove', (event: PointerEvent) => this.pointerMove(event)],
            [stage, 'pointerup', (event: PointerEvent) => this.pointerUp(stage, event)],
            [stage, 'pointercancel', (event: PointerEvent) => this.pointerUp(stage, event)],
            [stage, 'wheel', (event: WheelEvent) => this.wheel(event), { passive: false }],
            [window, 'resize', onResize],
            [motion, 'change', onMotion]
        ];
        for (const [target, type, listener, options] of listeners) {
            target.addEventListener(type, listener as EventListener, options);
        }
        onResize();
        onMotion();

        return () => {
            for (const [target, type, listener] of listeners) {
                target.removeEventListener(type, listener as EventListener);
            }
            if (this.raf !== null) {
                cancelAnimationFrame(this.raf);
                // A rescheduled frame must not be mistaken for a pending one:
                // StrictMode runs attach, detach, attach.
                this.raf = null;
            }
        };
    }

    private resize(width: number, height: number): void {
        this.viewport = { w: width, h: height };
        const pool = poolFor(width, height);
        if (pool.cols !== this.pool.cols || pool.rows !== this.pool.rows) {
            this.pool = pool;
            this.onPool(pool);
        }
        this.invalidate();
    }

    private interrupt(): void {
        this.center = null;
        this.onInteract();
        this.schedule();
    }

    private pointerDown(stage: HTMLElement, event: PointerEvent): void {
        stage.setPointerCapture(event.pointerId);
        stage.classList.add('dragging');
        this.drag = { active: true, x: event.clientX, y: event.clientY };
        this.velocity = { x: 0, y: 0 };
        this.interrupt();
    }

    private pointerMove(event: PointerEvent): void {
        if (!this.drag.active) {
            return;
        }
        const dx = event.clientX - this.drag.x;
        const dy = event.clientY - this.drag.y;
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
        this.pan.x += dx;
        this.pan.y += dy;
        this.velocity = {
            x: this.velocity.x * 0.55 + dx * 0.45,
            y: this.velocity.y * 0.55 + dy * 0.45
        };
        this.interrupt();
    }

    private pointerUp(stage: HTMLElement, event: PointerEvent): void {
        stage.classList.remove('dragging');
        if (!this.drag.active) {
            return;
        }
        this.drag.active = false;
        if (stage.hasPointerCapture(event.pointerId)) {
            stage.releasePointerCapture(event.pointerId);
        }
        this.schedule();
    }

    private wheel(event: WheelEvent): void {
        event.preventDefault();
        this.pan.x -= event.deltaX;
        this.pan.y -= event.deltaY;
        // A small glide carry makes mouse-wheel flicks feel natural.
        this.velocity = {
            x: this.velocity.x * 0.7 - event.deltaX * 0.1,
            y: this.velocity.y * 0.7 - event.deltaY * 0.1
        };
        this.interrupt();
    }

    /** Forces a redraw on the next frame, even when nothing moved. */
    private invalidate(): void {
        this.lastDrawn = '';
        this.schedule();
    }

    private schedule(): void {
        if (this.raf === null) {
            // A fresh loop measures from here, so the first frame does not
            // treat the whole idle gap as one giant timestep.
            this.lastTime = performance.now();
            this.raf = requestAnimationFrame(() => this.frame());
        }
    }

    private frame(): void {
        this.raf = null;
        const now = performance.now();
        // Physics in 60Hz ticks, so 120Hz displays do not pan twice as fast.
        const ticks = Math.min((now - this.lastTime) / (1000 / 60), 2);
        this.lastTime = now;

        if (this.center) {
            this.animateCenter(now);
        } else if (!this.drag.active && !this.flat) {
            this.glide(ticks);
        }

        this.draw();

        if (this.drag.active || this.center || this.velocity.x !== 0 || this.velocity.y !== 0) {
            this.schedule();
        }
    }

    private animateCenter(now: number): void {
        const { from, to, t0 } = this.center!;
        const t = Math.min((now - t0) / CENTER_DURATION, 1);
        const eased = easeOutCubic(t);
        this.pan.x = from.x + (to.x - from.x) * eased;
        this.pan.y = from.y + (to.y - from.y) * eased;
        if (t === 1) {
            this.center = null;
        }
    }

    private glide(ticks: number): void {
        this.pan.x += this.velocity.x * ticks;
        this.pan.y += this.velocity.y * ticks;
        const friction = Math.pow(FRICTION, ticks);
        const slow = (value: number): number =>
            Math.abs(value * friction) < REST_SPEED ? 0 : value * friction;
        this.velocity = { x: slow(this.velocity.x), y: slow(this.velocity.y) };
    }

    private draw(): void {
        const { w, h } = this.viewport;
        const picture = `${this.pan.x},${this.pan.y},${w},${h},${this.flat}`;
        if (picture === this.lastDrawn) {
            return;
        }
        this.lastDrawn = picture;

        const count = this.pool.cols * this.pool.rows;
        if (this.opacities.length !== count) {
            this.opacities = new Float32Array(count).fill(-1);
        }
        const center = { x: w / 2, y: h / 2 };
        const shape = domeShape(this.pool, w, h, this.preset);

        for (let slot = 0; slot < count; slot++) {
            const card = this.cards[slot];
            if (!card) {
                continue;
            }
            const offset = slotOffset(slot, this.pool, this.pan);
            if (this.flat) {
                card.style.transform = placeFlat(offset, center);
                this.writeOpacity(card, slot, 1);
            } else {
                const placed = placeOnDome(offset, center, shape, this.preset);
                card.style.transform = placed.transform;
                this.writeOpacity(card, slot, placed.opacity);
            }
        }
    }

    /**
     * Sub-0.01 opacity changes are skipped along with their string; drift
     * stays capped at 0.01 because the stored value only advances on writes.
     */
    private writeOpacity(card: HTMLElement, slot: number, opacity: number): void {
        if (Math.abs(opacity - this.opacities[slot]) >= 0.01) {
            card.style.opacity = opacity.toFixed(3);
            this.opacities[slot] = opacity;
        }
    }
}

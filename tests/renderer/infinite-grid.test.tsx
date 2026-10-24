import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { SummonRequest } from '../../src/renderer/shell/tile';
import { InfiniteGrid } from '../../src/renderer/shell/grid/infinite-grid';
import { tiles } from '../../src/renderer/tiles';
import { stubMatchMedia } from './stubs';

function request(widget: string, args: SummonRequest['args'] = {}): SummonRequest {
    return { widget, args, source: 'rules', confidence: 0.9, lowConfidence: false };
}

function renderGrid() {
    let summon!: (request: SummonRequest) => void;
    const view = render(
        <InfiniteGrid tiles={tiles}>
            {(next) => {
                summon = next;
                return <p>overlay</p>;
            }}
        </InfiniteGrid>
    );
    return { ...view, summon: (r: SummonRequest) => act(() => summon(r)) };
}

const slots = () => document.querySelectorAll('[data-index]');
const highlighted = () => document.querySelectorAll('.ring-2');

describe('the infinite grid', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', () => 1);
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        stubMatchMedia(false);
        window.innerWidth = 1024;
        window.innerHeight = 768;
        window.brooz = { invoke: vi.fn(() => new Promise(() => undefined)) as never };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('fills the pool with resting tiles and renders the overlay', () => {
        renderGrid();
        expect(slots()).toHaveLength(30);
        expect(screen.getByText('overlay')).toBeTruthy();
    });

    it('turns a summoned tile live, highlights it, then lets the highlight go', () => {
        const { summon } = renderGrid();
        summon(request('pomodoro', { durationMinutes: 5 }));
        expect(screen.getByText('05:00')).toBeTruthy();
        expect(highlighted()).toHaveLength(1);
        act(() => {
            vi.advanceTimersByTime(650);
        });
        expect(highlighted()).toHaveLength(0);
    });

    it('keeps a live tile on its slot and remounts it for new args', () => {
        const { summon } = renderGrid();
        summon(request('pomodoro', { durationMinutes: 5 }));
        const slot = screen.getByText('05:00').closest('[data-index]');
        summon(request('pomodoro', { durationMinutes: 7 }));
        expect(screen.queryByText('05:00')).toBe(null);
        expect(screen.getByText('07:00').closest('[data-index]')).toBe(slot);
    });

    it('renders a live tile without a remount key', () => {
        const { summon } = renderGrid();
        summon(request('analog-clock'));
        expect(screen.getAllByText('Local').length).toBeGreaterThan(0);
    });

    it('only centers a demo tile, it stays mock', () => {
        const { summon } = renderGrid();
        summon(request('ticker'));
        expect(highlighted()).toHaveLength(1);
        expect(screen.queryAllByText('Low confidence')).toHaveLength(0);
    });

    it('ignores a tile it does not know', () => {
        const { summon } = renderGrid();
        summon(request('nope'));
        expect(highlighted()).toHaveLength(0);
    });

    it('drops the highlight when the grid is grabbed', () => {
        const { summon, container } = renderGrid();
        summon(request('ticker'));
        const stage = container.querySelector('.grid-stage')!;
        Object.assign(stage, { setPointerCapture: () => undefined });
        fireEvent(stage, Object.assign(new Event('pointerdown'), { pointerId: 1 }));
        expect(highlighted()).toHaveLength(0);
    });

    it('moves a live tile to its kind on a new pool', () => {
        const { summon } = renderGrid();
        summon(request('pomodoro', { durationMinutes: 5 }));
        window.innerWidth = 2400;
        window.innerHeight = 1400;
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        expect(slots().length).toBeGreaterThan(30);
        expect(screen.getAllByText('05:00')).toHaveLength(1);
    });

    it('lets go of its cards when it unmounts', () => {
        const { unmount } = renderGrid();
        unmount();
        expect(slots()).toHaveLength(0);
    });
});

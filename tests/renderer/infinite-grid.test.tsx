import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { SummonRequest } from '../../src/renderer/shell/tile';
import { InfiniteGrid } from '../../src/renderer/shell/grid/infinite-grid';
import { tiles } from '../../src/renderer/tiles';
import { WEATHER, stubBrooz, stubMatchMedia } from './stubs';

function request(widget: string, args: SummonRequest['args'] = {}): SummonRequest {
    return { widget, args, source: 'rules', confidence: 0.9, lowConfidence: false };
}

function renderGrid(onOpenSettings = vi.fn()) {
    let summon!: (request: SummonRequest) => void;
    const view = render(
        <InfiniteGrid tiles={tiles} onOpenSettings={onOpenSettings}>
            {(next) => {
                summon = next;
                return <p>overlay</p>;
            }}
        </InfiniteGrid>
    );
    return { ...view, onOpenSettings, summon: (r: SummonRequest) => act(() => summon(r)) };
}

const slots = () => document.querySelectorAll('[data-index]');
const highlighted = () => document.querySelectorAll('.ring-2');
const emptyTiles = () => screen.getAllByText('Default tile');

describe('the infinite grid', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', () => 1);
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        stubMatchMedia(false);
        window.innerWidth = 1024;
        window.innerHeight = 768;
        stubBrooz({
            'brooz:app-version': () => '0.1.0',
            'brooz:weather': () => ({ status: 'ok', data: WEATHER }),
            'brooz:air-quality': () => new Promise(() => undefined),
            'brooz:stock-quotes': () => ({ status: 'ok', data: [] })
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it('fills the pool: every registered tile once, the default tile on the rest', () => {
        renderGrid();
        expect(slots()).toHaveLength(30);
        expect(emptyTiles()).toHaveLength(30 - tiles.length);
        expect(screen.getByText('overlay')).toBeTruthy();
    });

    it('opens the settings from a default tile', () => {
        const { onOpenSettings } = renderGrid();
        fireEvent.click(emptyTiles()[0].closest('button')!);
        expect(onOpenSettings).toHaveBeenCalled();
    });

    it('turns a summoned tile live, highlights it, then lets the highlight go', async () => {
        const { summon } = renderGrid();
        summon(request('weather', { city: 'Rome' }));
        expect(highlighted()).toHaveLength(1);
        await act(async () => {});
        expect(screen.getByText('21°')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(650);
        });
        expect(highlighted()).toHaveLength(0);
    });

    it('keeps a live tile on its slot and remounts it for new args', async () => {
        const { summon } = renderGrid();
        summon(request('weather', { city: 'Rome' }));
        await act(async () => {});
        const slot = screen.getByText('21°').closest('[data-index]');
        summon(request('weather', { city: 'Oslo' }));
        await act(async () => {});
        expect(screen.getByText('21°').closest('[data-index]')).toBe(slot);
    });

    it('only centers a tile without a live version, it stays mock', () => {
        const { summon } = renderGrid();
        summon(request('about'));
        expect(highlighted()).toHaveLength(1);
        expect(screen.getAllByText('About').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('Low confidence')).toHaveLength(0);
    });

    it('ignores a tile it does not know', () => {
        const { summon } = renderGrid();
        summon(request('nope'));
        expect(highlighted()).toHaveLength(0);
    });

    it('drops the highlight when the grid is grabbed', () => {
        const { summon, container } = renderGrid();
        summon(request('about'));
        const stage = container.querySelector('.grid-stage')!;
        Object.assign(stage, { setPointerCapture: () => undefined });
        fireEvent(stage, Object.assign(new Event('pointerdown'), { pointerId: 1 }));
        expect(highlighted()).toHaveLength(0);
    });

    it('moves a live tile to its kind on a new pool', async () => {
        const { summon } = renderGrid();
        summon(request('weather', { city: 'Rome' }));
        await act(async () => {});
        expect(screen.getByText('21°')).toBeTruthy();
        window.innerWidth = 2400;
        window.innerHeight = 1400;
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        await act(async () => {});
        expect(slots().length).toBeGreaterThan(30);
        expect(screen.getAllByText('21°')).toHaveLength(1);
    });

    it('lets go of its cards when it unmounts', () => {
        const { unmount } = renderGrid();
        unmount();
        expect(slots()).toHaveLength(0);
    });
});

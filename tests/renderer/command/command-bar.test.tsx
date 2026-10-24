import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { CommandBar } from '../../../src/renderer/shell/command/command-bar';
import { useLocalModel } from '../../../src/renderer/shell/command/use-local-model';
import { stubWorker } from '../stubs';
import type { FakeWorker } from '../stubs';

let workers: FakeWorker[] = [];
const latest = () => workers[workers.length - 1];

function setup() {
    const onSummon = vi.fn();
    const view = render(<CommandBar onSummon={onSummon} />);
    const input = screen.getByLabelText('Ask your dashboard') as HTMLInputElement;
    const type = (value: string) => fireEvent.change(input, { target: { value } });
    const press = (key: string) => fireEvent.keyDown(input, { key });
    return { ...view, onSummon, input, type, press, worker: latest() };
}

/** A worker message; a route answer settles a promise, so the act is async. */
async function emit(data: unknown) {
    await act(async () => {
        latest().emit(data);
        await Promise.resolve();
    });
}

const ready = { type: 'ready', runtime: { device: 'webgpu', dtype: 'q4f16' } };

describe('the ask bar with the rules', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        workers = stubWorker();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('starts loading the model and suggests examples', async () => {
        const { worker } = setup();
        expect(worker.posted).toEqual([{ type: 'load' }]);
        expect(worker.options).toEqual({ type: 'module' });
        expect(String(worker.url)).toContain('model-worker');
        expect(screen.getByText('Loading local model 0%')).toBeTruthy();
        expect(screen.getByText('weather in Rome')).toBeTruthy();
        await emit({ type: 'progress', progress: 26 });
        expect(screen.getByText('Loading local model 26%')).toBeTruthy();
    });

    it('routes with the rules while the model loads, then auto-summons the tile alone', () => {
        const { type, onSummon } = setup();
        type('weather in Rome');
        expect(screen.getByRole('option', { selected: true }).textContent).toContain('Weather');
        expect(screen.getByText('Rome')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(onSummon).toHaveBeenCalledWith({
            widget: 'weather',
            args: {},
            source: 'rules',
            confidence: 0.95,
            lowConfidence: false
        });
        type('weather in Rome!');
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(onSummon).toHaveBeenCalledTimes(1);
    });

    it('sums up what the utterance said about the tile', () => {
        const { type } = setup();
        type('show me a photo of mountains');
        expect(screen.getByText('“mountains”')).toBeTruthy();
        type('note: ' + 'a'.repeat(60));
        expect(screen.getByText(`“${'a'.repeat(45)}…”`)).toBeTruthy();
        type('how is apple stock doing');
        expect(screen.getByText('AAPL')).toBeTruthy();
        type('meetings tomorrow');
        expect(screen.getByText('tomorrow')).toBeTruthy();
        type('reset the pomodoro');
        expect(screen.getByText('Open widget')).toBeTruthy();
    });

    it('summons the selection with its args on Enter and clears the field', () => {
        const { type, press, input, onSummon } = setup();
        type('start a 25 minute timer');
        press('Enter');
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({
                widget: 'pomodoro',
                args: { durationMinutes: 25, action: 'start' }
            })
        );
        expect(input.value).toBe('');
        press('Enter');
        expect(onSummon).toHaveBeenCalledTimes(1);
    });

    it('says when a summoned tile is only demo data, for a while', () => {
        const { type, press } = setup();
        type('price of bitcoin');
        press('Enter');
        expect(screen.getByText(/^Markets is still demo data — its live source/)).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(6000);
        });
        expect(screen.getByText('↑↓ select · Enter open · Esc clears')).toBeTruthy();
    });

    it('opens a low-confidence route only on request, and says so', () => {
        const { type, press, onSummon } = setup();
        type('lunar rings');
        expect(screen.getByText('Low confidence — the top result opens anyway')).toBeTruthy();
        expect(screen.getByText('Low confidence')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onSummon).not.toHaveBeenCalled();
        press('Enter');
        expect(onSummon).toHaveBeenCalledWith(expect.objectContaining({ lowConfidence: true }));
    });

    it('moves the selection with the arrows and the mouse, and picks by click', () => {
        const { type, press, onSummon } = setup();
        type('clock timer');
        const selected = () => screen.getByRole('option', { selected: true }).textContent;
        expect(selected()).toContain('Pomodoro');
        press('ArrowDown');
        expect(selected()).toContain('Analog Clock');
        press('ArrowUp');
        press('ArrowUp');
        expect(selected()).toContain('World Clock');
        fireEvent.mouseEnter(screen.getAllByRole('option')[1]);
        expect(selected()).toContain('Analog Clock');
        fireEvent.click(screen.getAllByRole('option')[0]);
        expect(onSummon).toHaveBeenCalledWith(expect.objectContaining({ widget: 'pomodoro' }));
    });

    it('shows when nothing matched, and ignores the arrows then', async () => {
        const { type, press } = setup();
        await emit({ type: 'load-error', message: 'offline' });
        type('hello there');
        expect(screen.getByText('No widget matched “hello there”.')).toBeTruthy();
        press('ArrowDown');
        press('ArrowUp');
        press('Tab');
    });

    it('explains an empty list while the model loads', () => {
        const { type } = setup();
        type('hello');
        expect(
            screen.getByText('Loading the local model… rules are still available.')
        ).toBeTruthy();
    });

    it('clears the field on Escape, then lets go of the focus', () => {
        const { type, press, input } = setup();
        input.focus();
        type('weather');
        press('Escape');
        expect(input.value).toBe('');
        press('Escape');
        expect(document.activeElement).not.toBe(input);
    });

    it('fills the field from an example without summoning on its own', () => {
        const { press, input, onSummon } = setup();
        fireEvent.click(screen.getByText('note: buy milk'));
        expect(input.value).toBe('note: buy milk');
        expect(document.activeElement).toBe(input);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onSummon).not.toHaveBeenCalled();
        press('Enter');
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({ widget: 'sticky-note', args: { note: 'buy milk' } })
        );
    });

    it('focuses on Cmd+K and Ctrl+K', () => {
        const { input } = setup();
        fireEvent.keyDown(window, { key: 'k', metaKey: true });
        expect(document.activeElement).toBe(input);
        input.blur();
        fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
        expect(document.activeElement).toBe(input);
        input.blur();
        fireEvent.keyDown(window, { key: 'k' });
        fireEvent.keyDown(window, { key: 'j', metaKey: true });
        expect(document.activeElement).not.toBe(input);
    });

    it('offers a retry when the model cannot load', async () => {
        const { worker } = setup();
        await emit({ type: 'load-error', message: 'offline' });
        expect(screen.getByText('Local model unavailable')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(worker.posted).toEqual([{ type: 'load' }, { type: 'load' }]);
        expect(screen.getByText('Loading local model 0%')).toBeTruthy();
    });

    it('terminates the worker when it unmounts', () => {
        const { unmount, worker } = setup();
        unmount();
        expect(worker.terminated).toBe(true);
    });
});

describe('the ask bar with the local model', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        workers = stubWorker();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function routeRequests(worker: FakeWorker) {
        return worker.posted.filter(
            (message): message is { type: 'route'; id: number; text: string } =>
                (message as { type: string }).type === 'route'
        );
    }

    it('lets the model decide once it is ready', async () => {
        const { type, worker, onSummon } = setup();
        await emit(ready);
        expect(screen.getByText('Local model · webgpu · q4f16')).toBeTruthy();

        type('w');
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(routeRequests(worker)).toHaveLength(0);

        type('rain this weekend in Lisbon');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        expect(screen.getByText('Thinking with the local model…')).toBeTruthy();
        const [request] = routeRequests(worker);
        expect(request).toMatchObject({ id: 0, text: 'rain this weekend in Lisbon' });
        expect(screen.getByLabelText('Routing')).toBeTruthy();

        await emit({
            type: 'routed',
            id: 0,
            result: {
                widget: 'forecast',
                confidence: 0.91,
                probabilities: { forecast: 0.91, weather: 0.06, 'air-quality': 0.03 },
                latencyMs: 12
            }
        });
        const options = screen.getAllByRole('option').map((option) => option.textContent);
        expect(options).toHaveLength(3);
        expect(options[0]).toContain('5-Day Forecast');
        expect(options[0]).toContain('Lisbon');
        expect(options[0]).toContain('model');
        expect(options[1]).toContain('Weather');

        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({ widget: 'forecast', source: 'model', confidence: 0.91 })
        );
    });

    it('shows the failure when the model cannot route', async () => {
        const { type } = setup();
        await emit(ready);
        type('anything at all');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        await emit({ type: 'route-error', id: 0, message: 'The input is too long.' });
        expect(screen.getByText('The input is too long.')).toBeTruthy();
    });

    it('drops an answer to an older query', async () => {
        const { type } = setup();
        await emit(ready);
        type('first query');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        type('second query');
        await emit({
            type: 'routed',
            id: 0,
            result: {
                widget: 'weather',
                confidence: 0.9,
                probabilities: { weather: 0.9 },
                latencyMs: 1
            }
        });
        expect(screen.queryAllByRole('option')).toHaveLength(0);
        act(() => {
            vi.advanceTimersByTime(240);
        });
        type('third query');
        await emit({ type: 'route-error', id: 1, message: 'ignored' });
        expect(screen.queryByText('ignored')).toBe(null);
    });

    it('refuses to route before the model is ready', async () => {
        vi.useRealTimers();
        const { result } = renderHook(() => useLocalModel());
        await expect(result.current.route('weather')).rejects.toThrow(
            'The local model is not ready.'
        );
    });
});

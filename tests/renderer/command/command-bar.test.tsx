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
    const onOpenSettings = vi.fn();
    const view = render(<CommandBar onSummon={onSummon} onOpenSettings={onOpenSettings} />);
    const input = screen.getByLabelText('Ask your dashboard') as HTMLInputElement;
    const type = (value: string) => fireEvent.change(input, { target: { value } });
    const press = (key: string) => fireEvent.keyDown(input, { key });
    return { ...view, onSummon, onOpenSettings, input, type, press, worker: latest() };
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
        localStorage.clear();
        localStorage.setItem('brooz.model.enabled', '1');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('opens the settings from the button under the field', () => {
        const { onOpenSettings } = setup();
        fireEvent.click(screen.getByText('Settings Ctrl+,'));
        expect(onOpenSettings).toHaveBeenCalled();
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
        expect(screen.getByText('City Rome')).toBeTruthy();
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

    it('names each argument the utterance carries for the tile', () => {
        const { type } = setup();
        type('weather in Rome');
        expect(screen.getByText('City Rome')).toBeTruthy();
        type('how is apple stock doing');
        expect(screen.getByText('Symbol AAPL')).toBeTruthy();
        type('price of apple and tesla');
        expect(screen.getByText('Symbols AAPL · TSLA')).toBeTruthy();
        type('track flight LH1234');
        expect(screen.getByText('Flight LH1234')).toBeTruthy();
        type('track flights LH123 and BA456');
        expect(screen.getByText('Flights LH123 · BA456')).toBeTruthy();
        type('weather');
        expect(screen.getByText('Open tile')).toBeTruthy();
    });

    it('summons the selection with its args on Enter and clears the field', () => {
        const { type, press, input, onSummon } = setup();
        type('how is apple stock doing');
        press('Enter');
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({
                widget: 'ticker',
                args: { symbols: ['AAPL'] }
            })
        );
        expect(input.value).toBe('');
        press('Enter');
        expect(onSummon).toHaveBeenCalledTimes(1);
    });

    it('opens a low-confidence route only on request, and says so', () => {
        const { type, press, onSummon } = setup();
        type('weekend bitcoin');
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
        type('weather air quality stocks');
        const selected = () => screen.getByRole('option', { selected: true }).textContent;
        expect(selected()).toContain('Air Quality');
        press('ArrowDown');
        expect(selected()).toContain('Weather');
        press('ArrowUp');
        press('ArrowUp');
        expect(selected()).toContain('Markets');
        fireEvent.mouseEnter(screen.getAllByRole('option')[1]);
        expect(selected()).toContain('Weather');
        fireEvent.click(screen.getAllByRole('option')[0]);
        expect(onSummon).toHaveBeenCalledWith(expect.objectContaining({ widget: 'air-quality' }));
    });

    it('shows when nothing matched, and ignores the arrows then', async () => {
        const { type, press } = setup();
        await emit({ type: 'load-error', message: 'offline' });
        type('hello there');
        expect(screen.getByText('No widget matched “hello there”.')).toBeTruthy();
        type(`a very long utterance that matches nothing at all, ${'x'.repeat(30)}`);
        expect(screen.getByText(/^No widget matched “a very long utterance/)).toBeTruthy();
        expect(screen.getByText(/…”\.$/)).toBeTruthy();
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

    it('offers the saved quick actions by label, and puts the utterance into the field', () => {
        localStorage.setItem(
            'brooz.quick-actions',
            JSON.stringify([
                { label: 'My flight', utterance: 'track flight LH1234' },
                { label: '', utterance: 'weather in Oslo' }
            ])
        );
        const { input, type } = setup();
        expect(screen.queryByText('weather in Rome')).toBeNull();
        expect(screen.getByText('weather in Oslo')).toBeTruthy();
        fireEvent.click(screen.getByText('My flight'));
        expect(input.value).toBe('track flight LH1234');
        expect(screen.getByText('Flight LH1234')).toBeTruthy();
        type('');
        expect(screen.getByText('My flight')).toBeTruthy();
    });

    it('offers no quick action once the person removed them all', () => {
        localStorage.setItem('brooz.quick-actions', '[]');
        setup();
        expect(screen.queryByText('weather in Rome')).toBeNull();
        expect(screen.queryAllByRole('button', { name: /in Rome|LH123/ })).toEqual([]);
    });

    it('fills the field from a quick action without summoning on its own', () => {
        const { press, input, onSummon } = setup();
        fireEvent.click(screen.getByText('weather in Rome'));
        expect(input.value).toBe('weather in Rome');
        expect(document.activeElement).toBe(input);
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onSummon).not.toHaveBeenCalled();
        press('Enter');
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({ widget: 'weather', args: { city: 'Rome' } })
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
        localStorage.clear();
        localStorage.setItem('brooz.model.enabled', '1');
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

        type('should I bring a jacket in Lisbon');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        expect(screen.getByText('Thinking with the local model…')).toBeTruthy();
        const [request] = routeRequests(worker);
        expect(request).toMatchObject({ id: 0, text: 'should I bring a jacket in Lisbon' });
        expect(screen.getByLabelText('Routing')).toBeTruthy();

        await emit({
            type: 'routed',
            id: 0,
            result: {
                widget: 'weather',
                confidence: 0.91,
                probabilities: { weather: 0.91, 'air-quality': 0.06, ticker: 0.03 },
                latencyMs: 12
            }
        });
        const options = screen.getAllByRole('option').map((option) => option.textContent);
        expect(options).toHaveLength(3);
        expect(options[0]).toContain('Weather');
        expect(options[0]).toContain('Lisbon');
        expect(options[0]).toContain('model');
        expect(options[1]).toContain('Air Quality');

        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(onSummon).toHaveBeenCalledWith(
            expect.objectContaining({ widget: 'weather', source: 'model', confidence: 0.91 })
        );
    });

    it('keeps a confident rule hit on top when the model disagrees', async () => {
        const { type } = setup();
        await emit(ready);
        type('bitcoin');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        await emit({
            type: 'routed',
            id: 0,
            result: {
                widget: 'air-quality',
                confidence: 0.3,
                probabilities: { 'air-quality': 0.3, weather: 0.19, ticker: 0.05 },
                latencyMs: 12
            }
        });
        const options = screen.getAllByRole('option').map((option) => option.textContent);
        expect(options).toHaveLength(3);
        expect(options[0]).toContain('Markets');
        expect(options[0]).toContain('rules');
        expect(options[1]).toContain('Air Quality');
    });

    it('keeps the model answer when it agrees with the rule hit', async () => {
        const { type } = setup();
        await emit(ready);
        type('weather in Rome');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        await emit({
            type: 'routed',
            id: 0,
            result: {
                widget: 'weather',
                confidence: 0.9,
                probabilities: { weather: 0.9, 'air-quality': 0.1 },
                latencyMs: 12
            }
        });
        const [first] = screen.getAllByRole('option').map((option) => option.textContent);
        expect(first).toContain('Weather');
        expect(first).toContain('model');
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
        act(() => {
            vi.advanceTimersByTime(240);
        });
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

describe('the opt-in for the local model', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        workers = stubWorker();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('routes with the rules alone until the model is enabled', () => {
        const { type, onSummon } = setup();
        expect(workers).toHaveLength(0);
        expect(screen.getByText('Rules only')).toBeTruthy();
        type('weather in Rome');
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(onSummon).toHaveBeenCalledWith(expect.objectContaining({ source: 'rules' }));
    });

    it('downloads the model on request and remembers the choice', () => {
        const first = setup();
        fireEvent.click(screen.getByText('Enable local model · 380 MB'));
        expect(workers).toHaveLength(1);
        expect(workers[0].posted).toEqual([{ type: 'load' }]);
        expect(localStorage.getItem('brooz.model.enabled')).toBe('true');
        expect(screen.getByText('Loading local model 0%')).toBeTruthy();
        first.unmount();

        setup();
        expect(workers).toHaveLength(2);
        expect(workers[1].posted).toEqual([{ type: 'load' }]);
    });

    it('reports a worker that cannot start, and starts a new one on retry', async () => {
        localStorage.setItem('brooz.model.enabled', '1');
        const { type } = setup();
        await emit(ready);
        type('weather tomorrow');
        act(() => {
            vi.advanceTimersByTime(240);
        });
        await act(async () => {
            workers[0].fail();
            await Promise.resolve();
        });
        expect(workers[0].terminated).toBe(true);
        expect(screen.getByText('Local model unavailable')).toBeTruthy();
        expect(screen.getByText('The local model could not start.')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(workers).toHaveLength(2);
        expect(workers[1].posted).toEqual([{ type: 'load' }]);
    });
});

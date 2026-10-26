import { describe, expect, it } from 'vite-plus/test';
import { parseCommand } from '../../../src/renderer/shell/command/parse';
import { DEVELOPMENT_SET, HOLDOUT_SET, HOLDOUT_SET_2 } from '../../fixtures/routing';
import type { RoutingCase } from '../../fixtures/routing';

/** The utterances the rules route somewhere else, with where they went. */
function misses(cases: readonly RoutingCase[]): string[] {
    return cases.flatMap(({ text, expected }) => {
        const routed = parseCommand(text).best?.widget;
        return routed === expected ? [] : [`${text} -> ${routed} (expected ${expected})`];
    });
}

// The rules route every benchmark utterance correctly, as they did in the
// dashboard prototype. A change to a tile's route that breaks one shows up
// here by name.
describe('the rules on the routing benchmarks', () => {
    it('route the whole development set', () => {
        expect(DEVELOPMENT_SET).toHaveLength(45);
        expect(misses(DEVELOPMENT_SET)).toEqual([]);
    });

    it('route both holdout sets', () => {
        expect(misses(HOLDOUT_SET)).toEqual([]);
        expect(misses(HOLDOUT_SET_2)).toEqual([]);
    });
});

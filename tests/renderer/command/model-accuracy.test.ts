// @vitest-environment node
import { OpenJev } from 'open-jev';
import { describe, expect, it } from 'vite-plus/test';
import { ROUTED_TILES } from '../../../src/renderer/shell/command/manifest';
import { routeIntent } from '../../../src/renderer/shell/command/route-intent';
import { DEVELOPMENT_SET, HOLDOUT_SET, HOLDOUT_SET_2 } from '../../fixtures/routing';

/** One miss in 86 today ("write down call the dentist" -> calendar). */
const MAX_MISS_RATE = 0.02;

const OPTIONS = {
    ids: ROUTED_TILES.map((tile) => tile.id),
    descriptions: Object.fromEntries(ROUTED_TILES.map((tile) => [tile.id, tile.route.description]))
};

// The real model on the routing benchmarks. It downloads about 380 MB of
// weights on its first run, so it only runs on request: `npm run bench:model`.
describe.runIf(process.env.BROOZ_MODEL_BENCH)('the local model on the routing benchmarks', () => {
    it('routes the benchmark utterances', { timeout: 600_000 }, async () => {
        const jev = await OpenJev.load({ model: 'kev-0.6b' });
        const cases = [...DEVELOPMENT_SET, ...HOLDOUT_SET, ...HOLDOUT_SET_2];
        const misses: string[] = [];
        for (const { text, expected } of cases) {
            const { widget } = await routeIntent(jev, text, OPTIONS);
            if (widget !== expected) {
                misses.push(`${text} -> ${widget} (expected ${expected})`);
            }
        }
        expect(misses.length / cases.length, misses.join('\n')).toBeLessThanOrEqual(MAX_MISS_RATE);
    });
});

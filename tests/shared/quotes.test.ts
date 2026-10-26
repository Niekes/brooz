import { describe, expect, it } from 'vite-plus/test';
import { formatChange, formatPrice } from '../../src/shared/quotes';

describe('the quotes formatting', () => {
    it('formats a price the way a ticker writes it', () => {
        expect(formatPrice(189.4)).toBe('189.40');
        expect(formatPrice(67420)).toBe('67,420.00');
    });

    it("formats the day's change with its direction, or has nothing to say", () => {
        expect(formatChange(1.2)).toBe('▲ 1.20%');
        expect(formatChange(0)).toBe('▲ 0.00%');
        expect(formatChange(-0.8)).toBe('▼ 0.80%');
        expect(formatChange(null)).toBe('—');
    });
});

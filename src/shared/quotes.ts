/** How many tickers one live market tile shows. */
export const MAX_QUOTE_SYMBOLS = 5;

/**
 * A live market quote. The symbol is what the tile asked for, the way a
 * person writes it; how a provider spells it is the main process' concern.
 */
export interface StockQuote {
    readonly symbol: string;
    readonly price: number;
    /** The day's change in percent, or null when the provider has none. */
    readonly changePercent: number | null;
}

const PRICE = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

/** The price the way a ticker writes it. */
export function formatPrice(value: number): string {
    return PRICE.format(value);
}

/** The day's change with its direction, or nothing to say. */
export function formatChange(changePercent: number | null): string {
    if (changePercent === null) {
        return '—';
    }
    return `${changePercent >= 0 ? '▲' : '▼'} ${Math.abs(changePercent).toFixed(2)}%`;
}

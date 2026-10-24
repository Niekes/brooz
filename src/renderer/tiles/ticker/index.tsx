import type { JSX } from 'react';
import { TileHeader, WIDGET_BODY } from '../../shell/kit/chrome';
import { rng } from '../../shell/kit/seed';
import type { TileDefinition, TileProps } from '../../shell/tile';

const MARKETS = [
    { sym: 'BTC', name: 'Bitcoin', price: 67420 },
    { sym: 'ETH', name: 'Ethereum', price: 3241 },
    { sym: 'SOL', name: 'Solana', price: 148.2 },
    { sym: 'NVDA', name: 'Nvidia', price: 892.4 },
    { sym: 'AAPL', name: 'Apple', price: 189.6 },
    { sym: 'TSLA', name: 'Tesla', price: 242.1 },
    { sym: 'MSFT', name: 'Microsoft', price: 411.3 },
    { sym: 'SPY', name: 'S&P 500', price: 523.7 }
];

const PRICE = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
/** Semantic red and green: the one place where hue is the data itself. */
const UP = '#4ade80';
const DOWN = '#f87171';

/** A seeded random walk, biased toward the row's delta so the line agrees with the number. */
function sparkline(next: () => number, up: boolean): string {
    let value = 8;
    const values = Array.from({ length: 12 }, () => {
        value += (next() - 0.5) * 4 + (up ? 0.36 : -0.36);
        return value;
    });
    const min = Math.min(...values);
    const span = Math.max(...values) - min;
    return values
        .map(
            (v, k) =>
                `${((k / 11) * 46 + 1).toFixed(1)},${(14 - ((v - min) / span) * 12 + 1).toFixed(1)}`
        )
        .join(' ');
}

/** Three seeded rows with a seeded sparkline each. */
export function Ticker({ seed }: TileProps): JSX.Element {
    const first = Math.abs(seed) % MARKETS.length;
    const rows = [0, 3, 6].map((step) => MARKETS[(first + step) % MARKETS.length]);

    return (
        <div className={WIDGET_BODY}>
            <TileHeader title="Markets" tag="MOCK FEED" />

            <div className="flex min-h-0 flex-1 flex-col justify-between py-1">
                {rows.map((market, i) => {
                    const r = rng(seed + i * 37 + 5);
                    const delta = Math.round((r() * 9 - 4) * 100) / 100;
                    const up = delta >= 0;
                    const color = up ? UP : DOWN;

                    return (
                        <div key={market.sym} className="flex items-center gap-2.5">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-medium text-white">
                                    {market.sym}
                                </div>
                                <div className="truncate text-[9px] text-white/35">
                                    {market.name}
                                </div>
                            </div>
                            <svg
                                viewBox="0 0 48 16"
                                aria-hidden="true"
                                className="h-4 w-12 shrink-0"
                            >
                                <polyline
                                    points={sparkline(r, up)}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="1.3"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="shrink-0 text-right">
                                <div className="font-mono text-[11px] text-white/85">
                                    {PRICE.format(market.price * (1 + delta / 100))}
                                </div>
                                <div className="font-mono text-[9px]" style={{ color }}>
                                    {up ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/40">24H</span>
                <span className="font-mono text-[10px] text-white/30">DELAYED</span>
            </div>
        </div>
    );
}

export const tickerTile: TileDefinition = {
    id: 'ticker',
    title: 'Markets',
    Component: Ticker,
    route: {
        description:
            'Stock, cryptocurrency and market prices for symbols, including market overviews.',
        keywords: ['stock', 'share', 'market', 'ticker', 'price', 'bitcoin', 'crypto'],
        examples: ['how is apple stock doing', 'price of bitcoin'],
        pattern: /\b(?:stocks?|shares?|markets?|ticker|price|bitcoin|crypto)\b/,
        weight: 3,
        args: ({ symbols, query }) => ({ symbols, query })
    }
};

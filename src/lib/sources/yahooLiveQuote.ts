/**
 * On-demand OHLC candles for the Terminal tab's watchlist/chart — separate
 * from yahooIndex.ts, which feeds the ingestion pipeline's daily-close-only
 * historical series into Supabase. This fetches live, un-stored, full OHLC
 * data directly from Yahoo Finance's public chart endpoint (same
 * unofficial/undocumented but functional endpoint already relied on
 * elsewhere in this app — see yahooIndex.ts for that assessment) whenever a
 * user opens the tab or looks up a symbol, rather than persisting a series.
 *
 * This is deliberately display-only: no order placement, no broker
 * connection, no account credentials of any kind. Real trading execution
 * lives in StockSharp's own separate Windows desktop Terminal app (linked
 * from the page), not here.
 */

export type Candle = { t: string; o: number; h: number; l: number; c: number };

export type WatchlistItem = {
  symbol: string;
  label: string;
  assetClass: "Stock" | "Crypto" | "Forex" | "Custom";
};

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "AAPL", label: "Apple", assetClass: "Stock" },
  { symbol: "MSFT", label: "Microsoft", assetClass: "Stock" },
  { symbol: "NVDA", label: "Nvidia", assetClass: "Stock" },
  { symbol: "SPY", label: "S&P 500 (SPY)", assetClass: "Stock" },
  { symbol: "BTC-USD", label: "Bitcoin", assetClass: "Crypto" },
  { symbol: "ETH-USD", label: "Ethereum", assetClass: "Crypto" },
  { symbol: "EURUSD=X", label: "EUR/USD", assetClass: "Forex" },
  { symbol: "GBPUSD=X", label: "GBP/USD", assetClass: "Forex" },
  { symbol: "USDJPY=X", label: "USD/JPY", assetClass: "Forex" },
];

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

type ChartResponse = {
  chart: {
    result: [
      {
        timestamp: number[];
        indicators: {
          quote: [{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }];
        };
      },
    ] | null;
    error: unknown;
  };
};

export type CandleFetchResult = { candles: Candle[] } | { error: string };

export async function fetchYahooCandles(symbol: string, range = "3mo", interval = "1d"): Promise<CandleFetchResult> {
  try {
    const url = `${YAHOO_CHART_BASE}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" },
      // Short cache — near-live for a watchlist without re-fetching on every render.
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = (await res.json()) as ChartResponse;
    const result = json.chart.result?.[0];
    if (!result) return { error: `no data (${JSON.stringify(json.chart.error)})` };

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) return { error: "no OHLC data in response" };

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = quote.open[i];
      const h = quote.high[i];
      const l = quote.low[i];
      const c = quote.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({ t: new Date(timestamps[i] * 1000).toISOString(), o, h, l, c });
    }
    return { candles };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type TickerQuote = WatchlistItem & {
  candles: Candle[];
  lastPrice: number | null;
  changePct: number | null;
  error?: string;
};

export async function fetchTickerQuote(item: WatchlistItem): Promise<TickerQuote> {
  const result = await fetchYahooCandles(item.symbol);
  if ("error" in result) {
    return { ...item, candles: [], lastPrice: null, changePct: null, error: result.error };
  }
  const { candles } = result;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const lastPrice = last ? last.c : null;
  const changePct = last && prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : null;
  return { ...item, candles, lastPrice, changePct };
}

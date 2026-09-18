import { fetchYahooCandles } from "./yahooLiveQuote";

/**
 * On-demand, un-stored live quotes for market-moving events (e.g. a same-day
 * BOJ rate decision) — same pattern and same reasoning as
 * liveCommodityQuotes.ts: fetched fresh at page-render time from Yahoo
 * Finance's public chart endpoint, purely for display, never fed into any
 * stored series or z-score/engine math (those stay on the once-daily
 * pipeline's consistent, officially-sourced data).
 */

export type LiveMarketKey = "usdjpy" | "nikkei225";

const LIVE_MARKET_SOURCES: Record<LiveMarketKey, { symbol: string; unit: string }> = {
  usdjpy: { symbol: "USDJPY=X", unit: "JPY per USD" },
  nikkei225: { symbol: "^N225", unit: "index" },
};

export type LiveMarketQuote = {
  price: number;
  changePct: number | null; // vs the prior available close
  asOfIso: string;
  unit: string;
  symbol: string;
  fetchedAt: string;
};

export async function fetchLiveMarketQuote(key: LiveMarketKey): Promise<LiveMarketQuote | null> {
  const cfg = LIVE_MARKET_SOURCES[key];
  const result = await fetchYahooCandles(cfg.symbol, "5d", "1d");
  if ("error" in result) return null;
  const last = result.candles[result.candles.length - 1];
  const prev = result.candles[result.candles.length - 2];
  if (!last) return null;
  return {
    price: last.c,
    changePct: prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : null,
    asOfIso: last.t,
    unit: cfg.unit,
    symbol: cfg.symbol,
    fetchedAt: new Date().toISOString(),
  };
}

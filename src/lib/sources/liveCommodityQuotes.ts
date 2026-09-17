import { fetchYahooCandles } from "./yahooLiveQuote";
import { centsPerLbToUsdPerMt } from "./massiveFutures";

/**
 * On-demand, un-stored live quotes for the Daily Econometrics Report only —
 * reuses yahooLiveQuote.ts's same public, no-key Yahoo Finance chart
 * endpoint already relied on for the Terminal watchlist, fetched fresh at
 * report-generation time rather than read from Supabase's once-a-day cron
 * snapshot. This exists purely to label the report's headline price as
 * genuinely current; it deliberately does NOT feed into the z-score/ADF/
 * cointegration math below it (see individualMeanReversion.ts and
 * oilseedsPairsCointegration.ts), which needs a consistent, officially
 * settled historical series and would be corrupted by splicing in one live
 * intraday tick.
 *
 * CL=F (WTI) and ZL=F (Soybean Oil, CBOT) update their "current session"
 * daily bar intraday — verified live: today's close was a real running
 * price, not null, at a mid-session fetch. CPO=F (Malaysian Crude Palm Oil
 * Calendar Swap) does NOT — its current-session bar stays null until the
 * session closes, and its `meta.regularMarketPrice` field was confirmed
 * live to be stale by over a year — so for palm oil this always resolves to
 * the latest fully-settled session, same as the existing daily ingestion,
 * not a truer intraday tick. Disclosed via `intraday: false` rather than
 * silently presented as equally live.
 */

export type LiveCommodityKey = "wti_crude" | "soybean_oil" | "palm_oil";

const LIVE_QUOTE_SOURCES: Record<LiveCommodityKey, { symbol: string; unit: string; intraday: boolean; convert?: (native: number) => number }> = {
  wti_crude: { symbol: "CL=F", unit: "$/bbl", intraday: true },
  soybean_oil: { symbol: "ZL=F", unit: "$/mt", intraday: true, convert: centsPerLbToUsdPerMt },
  palm_oil: { symbol: "CPO=F", unit: "$/mt", intraday: false },
};

export type LiveQuote = {
  price: number;
  asOfIso: string; // the exchange session date/time this price is from
  unit: string;
  symbol: string;
  intraday: boolean;
  fetchedAt: string; // when THIS report generation fetched it
};

export async function fetchLiveCommodityQuote(key: LiveCommodityKey): Promise<LiveQuote | null> {
  const cfg = LIVE_QUOTE_SOURCES[key];
  const result = await fetchYahooCandles(cfg.symbol, "5d", "1d");
  if ("error" in result) return null;
  const last = result.candles[result.candles.length - 1];
  if (!last) return null;
  return {
    price: cfg.convert ? cfg.convert(last.c) : last.c,
    asOfIso: last.t,
    unit: cfg.unit,
    symbol: cfg.symbol,
    intraday: cfg.intraday,
    fetchedAt: new Date().toISOString(),
  };
}

import type { MetricPoint } from "../metrics/store";

/**
 * Yahoo Finance's public chart endpoint — unofficial/undocumented, no key,
 * but widely relied on in practice and currently functional. Used only as a
 * fallback for indices that have no FRED coverage (Russell 2000 has no free
 * FRED series; Nifty 50 is India-specific and not in FRED at all). Tier 3:
 * treat as a secondary aggregator, not an official primary source, and
 * expect this connector to need maintenance if the endpoint shape changes.
 * Stooq was evaluated and rejected — as of this writing it fronts a
 * proof-of-work bot challenge that a server-side fetch cannot satisfy.
 */

export type YahooIndexDef = { metricKey: string; symbol: string; unit: string; range?: string };

export const YAHOO_INDEX_SERIES: YahooIndexDef[] = [
  { metricKey: "equity.russell2000", symbol: "^RUT", unit: "index" },
  { metricKey: "equity.nifty50", symbol: "^NSEI", unit: "index" },
  // G7 equity benchmarks with no FRED coverage (Nikkei 225 already comes via FRED)
  { metricKey: "equity.dax", symbol: "^GDAXI", unit: "index" },
  { metricKey: "equity.ftse100", symbol: "^FTSE", unit: "index" },
  { metricKey: "equity.cac40", symbol: "^FCHI", unit: "index" },
  { metricKey: "equity.ftsemib", symbol: "FTSEMIB.MI", unit: "index" },
  { metricKey: "equity.tsx_composite", symbol: "^GSPTSE", unit: "index" },
  { metricKey: "equity.shanghai_composite", symbol: "000001.SS", unit: "index" },
  // Market Concentration engine — cap-weighted vs equal-weighted ETF pairs
  { metricKey: "equity.spy_cap_weighted", symbol: "SPY", unit: "USD" },
  { metricKey: "equity.rsp_equal_weighted", symbol: "RSP", unit: "USD" },
  { metricKey: "equity.qqq_cap_weighted", symbol: "QQQ", unit: "USD" },
  { metricKey: "equity.qqqe_equal_weighted", symbol: "QQQE", unit: "USD" },
  // Private Credit engine — publicly-traded BDCs as a market-based stress proxy
  { metricKey: "privatecredit.bdc_arcc", symbol: "ARCC", unit: "USD" },
  { metricKey: "privatecredit.bdc_main", symbol: "MAIN", unit: "USD" },
  { metricKey: "privatecredit.bdc_fsk", symbol: "FSK", unit: "USD" },
  { metricKey: "privatecredit.bdc_obdc", symbol: "OBDC", unit: "USD" },
  { metricKey: "privatecredit.bdc_bxsl", symbol: "BXSL", unit: "USD" },
  // AI Valuation engine — stock prices for the SEC-EDGAR-tracked AI companies
  { metricKey: "ai.msft.price", symbol: "MSFT", unit: "USD" },
  { metricKey: "ai.googl.price", symbol: "GOOGL", unit: "USD" },
  { metricKey: "ai.amzn.price", symbol: "AMZN", unit: "USD" },
  { metricKey: "ai.meta.price", symbol: "META", unit: "USD" },
  { metricKey: "ai.orcl.price", symbol: "ORCL", unit: "USD" },
  { metricKey: "ai.nvda.price", symbol: "NVDA", unit: "USD" },
  { metricKey: "ai.amd.price", symbol: "AMD", unit: "USD" },
  { metricKey: "ai.avgo.price", symbol: "AVGO", unit: "USD" },
  // Crypto/Stablecoins engine — spot price with real multi-year history. CoinGecko's free
  // tier only exposes a live snapshot (no historical backfill), which left this engine stuck
  // below the 20-observation z-score floor for weeks. investing.com has no free public API and
  // scraping it would break this project's no-scraping/official-source-only discipline, so BTC
  // and ETH spot price move to Yahoo's chart endpoint instead, which has genuine daily history
  // back to 2014-15 for both. CoinGecko remains the source for market cap, BTC dominance and
  // stablecoin peg/supply, which Yahoo doesn't publish.
  { metricKey: "crypto.btc_price_usd", symbol: "BTC-USD", unit: "USD", range: "5y" },
  { metricKey: "crypto.eth_price_usd", symbol: "ETH-USD", unit: "USD", range: "5y" },
  // Banking Systemic Risk engine (bankingSystemicRisk.ts) — Market Stress
  // domain. No free source publishes bank CDS or a uniform cross-country
  // bank-equity-sector index API, so this is the free next-best: a broad
  // bank-sector index/ETF where one exists, a single large representative
  // bank's equity where it doesn't. All seven verified live with fresh
  // (multi-week, current) daily bars before being added; two rejected
  // candidates are noted per-country below since they LOOKED plausible but
  // returned zero recent bars when actually checked.
  { metricKey: "banking.equity_us", symbol: "^BKX", unit: "index" }, // KBW Nasdaq Bank Index
  // Europe (proxy for the Eurozone G7 members Germany/France/Italy):
  // EURO STOXX Banks (^SX7E) returned zero bars in the last month when
  // checked — dead on Yahoo despite resolving — so this uses the iShares
  // STOXX Europe 600 Banks UCITS ETF instead, a broader (not Eurozone-only)
  // but genuinely live European bank-sector proxy.
  { metricKey: "banking.equity_europe", symbol: "EXV1.DE", unit: "EUR" },
  // UK: FTSE 350 Banks (^NMX8350) also returned zero recent bars when
  // checked — Barclays, a large UK G-SIB, is used as a single-bank proxy
  // instead (disclosed as such, not presented as a broad index).
  { metricKey: "banking.equity_uk", symbol: "BARC.L", unit: "GBp" },
  { metricKey: "banking.equity_japan", symbol: "1631.T", unit: "JPY" }, // NEXT FUNDS TOPIX-17 Banks ETF
  { metricKey: "banking.equity_canada", symbol: "ZEB.TO", unit: "CAD" }, // BMO Equal Weight Banks Index ETF
  { metricKey: "banking.equity_china", symbol: "3988.HK", unit: "HKD" }, // ICBC — single large-bank proxy, no free China bank-sector index found live
  { metricKey: "banking.equity_india", symbol: "^NSEBANK", unit: "index" }, // Nifty Bank Index
  // Property Systemic Risk engine (propertySystemicRisk.ts) — Market Stress
  // domain. Same "broad REIT/property-sector ETF where one exists, single
  // large representative developer where it doesn't" pattern as the Banking
  // engine's Market domain above. All seven verified live with fresh daily
  // bars before being added; India's Nifty Realty index (^CNXREALTY) was
  // checked and rejected — it resolves but returns a single stale bar, dead
  // on Yahoo despite resolving, same failure shape as the two banking-index
  // rejections above.
  { metricKey: "property.reit_us", symbol: "VNQ", unit: "USD" }, // Vanguard Real Estate ETF
  { metricKey: "property.reit_uk", symbol: "IUKP.L", unit: "GBp" }, // iShares UK Property UCITS ETF
  { metricKey: "property.reit_canada", symbol: "XRE.TO", unit: "CAD" }, // iShares S&P/TSX Capped REIT ETF
  // Europe (proxy for the Eurozone members Germany/France/Italy):
  { metricKey: "property.reit_europe", symbol: "IPRP.L", unit: "GBp" }, // iShares European Property Yield UCITS ETF (LSE-listed, GBp-denominated despite covering EU property)
  { metricKey: "property.reit_japan", symbol: "1343.T", unit: "JPY" }, // NEXT FUNDS REIT Index ETF
  { metricKey: "property.reit_china", symbol: "3187.HK", unit: "HKD" }, // CSOP CSI China Mainland Real Estate ETF
  // India: ^CNXREALTY (Nifty Realty) rejected (1 stale bar) — DLF Ltd, India's
  // largest listed developer, used as a single-company proxy instead.
  { metricKey: "property.reit_india", symbol: "DLF.NS", unit: "INR" },
];

type ChartResponse = {
  chart: {
    result: [
      {
        timestamp: number[];
        indicators: { quote: [{ close: (number | null)[] }] };
      },
    ] | null;
    error: unknown;
  };
};

export async function fetchYahooIndexSeries(def: YahooIndexDef): Promise<MetricPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=${def.range ?? "1y"}&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex-ingest/1.0)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo ${def.symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as ChartResponse;
  const result = json.chart.result?.[0];
  if (!result) throw new Error(`Yahoo ${def.symbol}: no result (${JSON.stringify(json.chart.error)})`);

  const closes = result.indicators.quote[0].close;
  const points: MetricPoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined) continue;
    const date = new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10);
    points.push({
      metric_key: def.metricKey,
      observed_at: date,
      value: close,
      unit: def.unit,
      source_key: "yahoo_finance",
      source_tier: 3,
      frequency: "daily",
    });
  }
  return points;
}

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

export type YahooIndexDef = { metricKey: string; symbol: string; unit: string };

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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=1y&interval=1d`;
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

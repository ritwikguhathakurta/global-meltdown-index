import type { MetricPoint } from "../metrics/store";

/**
 * FX via Frankfurter (ECB daily reference rates) — free, no API key, Tier 1
 * (the underlying publisher is the European Central Bank). Confirmed live at
 * api.frankfurter.dev/v1 (the project moved off frankfurter.app in 2025;
 * that old host now 301s here). ECB publishes ~16:00 CET on TARGET business
 * days, so this is a "daily" series with expected gaps on weekends/holidays.
 *
 * Cross rates are derived from USD-quoted rates: USDJPY is direct, AUDJPY =
 * USDJPY / USDAUD (JPY per AUD), etc. — computed here, not fetched, so the
 * arithmetic is deterministic and auditable.
 */

type Rates = { JPY: number; AUD: number; NZD: number; INR: number; BRL: number; ZAR: number; MXN: number; CNY: number };

const CROSS_DEFS: { metricKey: string; unit: string; compute: (r: Rates) => number }[] = [
  { metricKey: "fx.usdjpy", unit: "JPY", compute: (r) => r.JPY },
  { metricKey: "fx.audjpy", unit: "JPY", compute: (r) => r.JPY / r.AUD },
  { metricKey: "fx.nzdjpy", unit: "JPY", compute: (r) => r.JPY / r.NZD },
  { metricKey: "fx.usdinr", unit: "INR", compute: (r) => r.INR },
  // EM Debt / China engines — direct USD-quoted rates, no cross computation needed
  { metricKey: "fx.usdbrl", unit: "BRL", compute: (r) => r.BRL },
  { metricKey: "fx.usdzar", unit: "ZAR", compute: (r) => r.ZAR },
  { metricKey: "fx.usdmxn", unit: "MXN", compute: (r) => r.MXN },
  { metricKey: "fx.usdcny", unit: "CNY", compute: (r) => r.CNY },
];

type RangeResponse = {
  rates: Record<string, Partial<Rates>>;
};

export async function fetchFxCrossSeries(sinceIso: string): Promise<MetricPoint[]> {
  const since = sinceIso.slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${since}..?base=USD&symbols=JPY,AUD,NZD,INR,BRL,ZAR,MXN,CNY`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Frankfurter FX: HTTP ${res.status}`);
  const json = (await res.json()) as RangeResponse;

  const points: MetricPoint[] = [];
  for (const [date, r] of Object.entries(json.rates)) {
    if (
      r.JPY === undefined || r.AUD === undefined || r.NZD === undefined || r.INR === undefined ||
      r.BRL === undefined || r.ZAR === undefined || r.MXN === undefined || r.CNY === undefined
    ) continue;
    for (const def of CROSS_DEFS) {
      points.push({
        metric_key: def.metricKey,
        observed_at: date,
        value: Math.round(def.compute(r as Rates) * 10000) / 10000,
        unit: def.unit,
        source_key: "frankfurter",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  return points;
}

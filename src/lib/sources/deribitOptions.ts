import type { MetricPoint } from "../metrics/store";

/**
 * Deribit public market-data API — free, no key or login:
 *
 *   https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option
 *
 * Verified live (2026-09-25): every listed BTC/ETH option with its real `open_interest` (in
 * BTC/ETH). Summed across all strikes and expiries into whole-market call OI, put OI and a
 * put/call OI ratio — the only real listed-options positioning series this project has, since
 * DERIVATIVES_ENGINE.md's "no free options source" disclosure covered equity options chains,
 * not crypto. A single commercial exchange (the largest crypto options venue), so Tier 3 and
 * labeled as such wherever shown, like okxPerpetuals.ts.
 *
 * Instrument names end in "-C" (call) or "-P" (put), e.g. BTC-27MAR26-80000-C.
 */
const BASE_URL = "https://www.deribit.com/api/v2/public";
const CURRENCIES = [
  { currency: "BTC", slug: "btc" },
  { currency: "ETH", slug: "eth" },
];

type Summary = { instrument_name: string; open_interest: number };

export async function fetchDeribitOptions(): Promise<MetricPoint[]> {
  const observed_at = new Date().toISOString().slice(0, 10);
  const points: MetricPoint[] = [];
  const failures: string[] = [];
  for (const { currency, slug } of CURRENCIES) {
    const res = await fetch(`${BASE_URL}/get_book_summary_by_currency?currency=${currency}&kind=option`, { next: { revalidate: 0 } });
    if (!res.ok) {
      failures.push(`${currency}: HTTP ${res.status}`);
      continue;
    }
    const rows = ((await res.json()) as { result?: Summary[] }).result ?? [];
    let call = 0;
    let put = 0;
    for (const r of rows) {
      if (!Number.isFinite(r.open_interest)) continue;
      if (r.instrument_name.endsWith("-C")) call += r.open_interest;
      else if (r.instrument_name.endsWith("-P")) put += r.open_interest;
    }
    if (call <= 0) {
      failures.push(`${currency}: no call open interest in response`);
      continue;
    }
    const base = { observed_at, source_key: "deribit_options", source_tier: 3 as const, frequency: "daily" as const };
    points.push({ ...base, metric_key: `derivatives.deribit.${slug}_options.call_oi`, value: call, unit: currency });
    points.push({ ...base, metric_key: `derivatives.deribit.${slug}_options.put_oi`, value: put, unit: currency });
    points.push({ ...base, metric_key: `derivatives.deribit.${slug}_options.pcr_oi`, value: put / call, unit: "ratio" });
  }
  if (points.length === 0) throw new Error(`Deribit options: no data (${failures.join("; ") || "no HTTP error recorded"})`);
  return points;
}

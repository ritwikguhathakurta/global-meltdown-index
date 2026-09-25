import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * FBIL (Financial Benchmarks India) — the RBI-recognised administrator of India's official
 * money-market benchmarks. Its public dashboard (fbil.org.in) reads unauthenticated JSON from
 * its own backend; login is only for subscribers/submitters:
 *
 *   https://www.fbil.org.in/wasdm/tbill/fetch?authenticated=false      T-Bill curve (7D-12M)
 *   https://www.fbil.org.in/wasdm/miborois/fetch?authenticated=false   MIBOR OIS curve (1M-5Y)
 *   https://www.fbil.org.in/wasdm/cd/fetch?authenticated=false         Certificate of Deposit curve
 *
 * Verified live (2026-09-25): each returns the two most recent published days, one row per
 * tenor, with the benchmark `rate` in percent. The public dashboard lags the publication date
 * (latest was 2026-09-17 when checked), so freshness is judged on the observed date.
 *
 * This is the official benchmark data that CCIL's own rates feed underlies; CCIL itself is not
 * used because its terms forbid automated collection (see rbiYieldCurve.ts). FBIL's own terms
 * of use were not located when this was built — the connector relies on the public unauthenticated
 * endpoints the site's own dashboard uses; revisit if FBIL states redistribution terms.
 */
const BASE = "https://www.fbil.org.in/wasdm";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

type Row = { processRunDate: string; tenorName: string; rate: number };

const CURVES: { path: string; prefix: string; tenors: Record<string, string> }[] = [
  { path: "tbill", prefix: "india.fbil.tbill", tenors: { "1 Month": "1m", "3 Months": "3m", "6 Months": "6m", "12 Months": "12m" } },
  { path: "miborois", prefix: "india.fbil.mibor_ois", tenors: { "3M": "3m", "1Y": "1y", "2Y": "2y", "5Y": "5y" } },
  { path: "cd", prefix: "india.fbil.cd", tenors: { "3 Months": "3m", "12 Months": "12m" } },
];

export async function fetchFbilBenchmarks(): Promise<MetricPoint[]> {
  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const curve of CURVES) {
    try {
      const res = await fetchRetry(`${BASE}/${curve.path}/fetch?authenticated=false`, { headers: HEADERS, next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as Row[];
      for (const r of rows) {
        const slug = curve.tenors[r.tenorName];
        const date = r.processRunDate?.slice(0, 10);
        if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(r.rate) || r.rate <= 0) continue;
        points.push({
          metric_key: `${curve.prefix}_${slug}`,
          observed_at: date,
          value: r.rate,
          unit: "%",
          source_key: "fbil_benchmarks",
          source_tier: 1,
          frequency: "daily",
        });
      }
    } catch (e) {
      errors.push(`${curve.path}: ${(e as Error).message}`);
    }
  }
  if (points.length === 0) throw new Error(`FBIL benchmarks: no data (${errors.join("; ") || "no usable rows"})`);
  return points;
}

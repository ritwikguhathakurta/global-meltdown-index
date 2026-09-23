import type { MetricPoint } from "../metrics/store";

/**
 * NY Fed Markets Data API — free, no-key, no-auth JSON at markets.newyorkfed.org. Verified live
 * before use: `/api/rates/secured/all/latest.json` returns SOFR, TGCR (Tri-Party General Collateral
 * Rate) and BGCR (Broad General Collateral Rate), each with percentile bands (1st/25th/75th/99th)
 * AND daily traded volume in USD billions — real funding-market depth/dispersion data no other
 * source in this repo tracks (`fred.ts` already has plain daily SOFR from FRED, but not the
 * percentile spread or volume, which is what actually signals repo-market stress: a widening
 * 99th-1st percentile spread or a volume spike is the real-world early sign of collateral scarcity,
 * spec §12's "Repo Volume / Dealer Equity" and "Collateral Value / Available Funding" starting
 * point). TGCR/BGCR are new series this repo doesn't have; SOFR here is redundant with `fred.ts`'s
 * `rate.sofr` but namespaced separately (`derivatives.repo.*`) since it carries the percentile/volume
 * fields FRED's plain SOFR series doesn't.
 *
 * The `/api/rp/all/all/results/latest.json` repo-operations endpoint was also checked live and
 * currently returns an empty operations array (no active RBI-style standing facility draws right
 * now) — this is a real "nothing happened" result, not a broken connector, so it's not wired in as
 * a metric (nothing to upsert), but the endpoint is confirmed live for future use if the Fed
 * conducts an operation.
 */
const RATES_URL = "https://markets.newyorkfed.org/api/rates/secured/all/latest.json";

type RateSeries = { type: string; metricKeyBase: string; label: string };

const SERIES: RateSeries[] = [
  { type: "SOFR", metricKeyBase: "derivatives.repo.sofr", label: "Secured Overnight Financing Rate" },
  { type: "TGCR", metricKeyBase: "derivatives.repo.tgcr", label: "Tri-Party General Collateral Rate" },
  { type: "BGCR", metricKeyBase: "derivatives.repo.bgcr", label: "Broad General Collateral Rate" },
];

type NyFedRateRow = {
  effectiveDate: string;
  type: string;
  percentRate?: number;
  percentPercentile1?: number;
  percentPercentile25?: number;
  percentPercentile75?: number;
  percentPercentile99?: number;
  volumeInBillions?: number;
};

export async function fetchNyFedRepoRates(): Promise<MetricPoint[]> {
  const res = await fetch(RATES_URL, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`NY Fed repo rates: HTTP ${res.status}`);
  const json = (await res.json()) as { refRates?: NyFedRateRow[] };
  const rows = json.refRates ?? [];
  if (rows.length === 0) throw new Error("NY Fed repo rates: empty response");

  const points: MetricPoint[] = [];
  for (const series of SERIES) {
    const row = rows.find((r) => r.type === series.type);
    if (!row || row.percentRate === undefined) continue;
    const observedAt = row.effectiveDate;
    points.push({
      metric_key: `${series.metricKeyBase}.rate`,
      observed_at: observedAt,
      value: row.percentRate,
      unit: "%",
      source_key: "nyfed_repo",
      source_tier: 1,
      frequency: "daily",
    });
    if (row.percentPercentile1 !== undefined && row.percentPercentile99 !== undefined) {
      points.push({
        metric_key: `${series.metricKeyBase}.dispersion`,
        observed_at: observedAt,
        value: row.percentPercentile99 - row.percentPercentile1,
        unit: "pp (99th-1st percentile)",
        source_key: "nyfed_repo",
        source_tier: 1,
        frequency: "daily",
      });
    }
    if (row.volumeInBillions !== undefined) {
      points.push({
        metric_key: `${series.metricKeyBase}.volume`,
        observed_at: observedAt,
        value: row.volumeInBillions,
        unit: "USD bn",
        source_key: "nyfed_repo",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  if (points.length === 0) throw new Error("NY Fed repo rates: no recognized series in response");
  return points;
}

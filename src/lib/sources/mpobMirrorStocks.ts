import type { MetricPoint } from "../metrics/store";

/**
 * Malaysia — MPOB monthly CPO / total palm oil stock levels, via
 * palmoileconomics.com's free, no-login public CSV mirror of MPOB's own
 * monthly industry release. Live cross-check: the site's August 2026 CPO
 * production/stock/export/FFB-price figures matched an independent news
 * write-up of the same MPOB release exactly, to the tonne.
 *
 * Only cpo_stock and total_po_stock are ingested from that CSV. Checked
 * per-indicator monthly coverage live: those two are complete with zero
 * gaps across the full 2000-2026 span, but every other indicator in the
 * same file (production, exports, imports, FFB price) has whole years
 * missing (e.g. 2015/2018/2019 absent for CPO production) — using those
 * would imply a completeness the source doesn't actually have.
 *
 * This is a third-party mirror, not MPOB's own site (whose own report
 * catalogue only exposes ~3 years of exports — see mpobMalaysia.ts), so
 * it's kept as its own tier-3 metric namespace ("mpob_mirror") rather than
 * merged into the tier-1 "mpob_malaysia" series, to avoid ever implying
 * these came directly from MPOB.
 */

const CSV_URL = "https://palmoileconomics.com/data/mpob/csv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const WANTED_INDICATORS = new Set(["cpo_stock", "total_po_stock"]);

export async function fetchMpobMirrorStocks(): Promise<MetricPoint[]> {
  const res = await fetch(CSV_URL, { headers: { "User-Agent": UA }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`MPOB mirror (palmoileconomics.com): HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  const points: MetricPoint[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("month,")) continue;
    const [month, indicator, valueRaw] = line.split(",");
    if (!month || !WANTED_INDICATORS.has(indicator)) continue;
    const tonnes = parseFloat(valueRaw);
    if (Number.isNaN(tonnes)) continue;
    points.push({
      metric_key: `commodity.palm_oil.malaysia.mpob_mirror.${indicator}`,
      observed_at: month,
      value: tonnes / 1_000_000,
      unit: "million MT",
      source_key: "mpob_mirror",
      source_tier: 3,
      frequency: "monthly",
    });
  }
  return points;
}

import type { MetricPoint } from "../metrics/store";

/**
 * Malaysia — MPOB monthly figures via palmoileconomics.com's free, no-login
 * public CSV mirror of MPOB's own monthly industry release. Live cross-check:
 * the site's August 2026 CPO production/stock/export/FFB-price figures
 * matched an independent news write-up of the same MPOB release exactly, to
 * the tonne.
 *
 * Only cpo_stock, total_po_stock, and po_export are ingested from that CSV,
 * each checked for per-indicator monthly coverage before use:
 *   - cpo_stock / total_po_stock: complete with zero gaps across the full
 *     2000-2026 span.
 *   - po_export: real gaps exist (e.g. 2015/2018/2019 entirely absent), but
 *     6 individual calendar years are fully complete (all 12 months) —
 *     2013, 2014, 2017, 2021, 2024, 2025. Used only for the seasonality
 *     engine (oilseedsSeasonality.ts), which already discards any
 *     incomplete year on its own — so the gaps here don't corrupt that
 *     calculation, they just mean fewer contributing years than a truly
 *     gap-free series would give.
 * Every other indicator in the same file (production, imports, FFB price)
 * has far patchier coverage and isn't used here.
 *
 * This is a third-party mirror, not MPOB's own site (whose own report
 * catalogue only exposes ~3 years of exports — see mpobMalaysia.ts), so
 * it's kept as its own tier-3 metric namespace ("mpob_mirror") rather than
 * merged into the tier-1 "mpob_malaysia" series, to avoid ever implying
 * these came directly from MPOB. In particular, the "latest export volume"
 * figures shown elsewhere on the Oilseeds page still come from MPOB's own
 * site (mpobMalaysia.ts) — this mirror's po_export is used only where
 * multi-year history matters more than sourcing tier, i.e. seasonality.
 */

const CSV_URL = "https://palmoileconomics.com/data/mpob/csv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const WANTED_INDICATORS = new Set(["cpo_stock", "total_po_stock", "po_export"]);

export async function fetchMpobMirror(): Promise<MetricPoint[]> {
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

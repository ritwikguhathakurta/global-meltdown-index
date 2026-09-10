import type { MetricPoint } from "../metrics/store";

/**
 * BIS "Selected residential property prices" (dataflow WS_SPP) — the exact
 * same underlying BIS series the app's other eight countries already get
 * via FRED mirrors (property.hpi_real_us = FRED QUSR628BIS, etc. — see
 * fred.ts). FRED does not mirror India's series, so this fetches it
 * directly from BIS's own free, no-key SDMX REST API instead, for the
 * Property Systemic Risk engine (propertySystemicRisk.ts).
 *
 * Verified live before writing this: the dataflow's real dimension order is
 * FREQ.REF_AREA.VALUE.UNIT_MEASURE (checked against BIS's own published
 * data structure, not guessed), VALUE=R selects the real (CPI-deflated)
 * series, and UNIT_MEASURE=628 selects the index-level series (matching the
 * "628" embedded in every other country's FRED series ID here) rather than
 * the YoY-growth-rate series BIS also publishes under a different
 * UNIT_MEASURE code. India's series is fresh through 2026-Q1 as of this
 * writing — checked directly, not assumed.
 */
export async function fetchIndiaPropertyPrices(): Promise<MetricPoint[]> {
  const url = "https://stats.bis.org/api/v1/data/BIS,WS_SPP,1.0/Q.IN.R.628?format=csv&startPeriod=2005";
  const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BIS residential property prices (India): HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (periodIdx === -1 || valueIdx === -1) throw new Error("BIS residential property prices (India): unexpected CSV header");

  const points: MetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const period = cols[periodIdx];
    const m = period?.match(/^(\d{4})-Q([1-4])$/);
    if (!m) continue;
    const v = parseFloat(cols[valueIdx]);
    if (Number.isNaN(v)) continue;
    const quarterEndMonth = [null, "03-31", "06-30", "09-30", "12-31"][Number(m[2])];
    points.push({
      metric_key: "property.hpi_real_india",
      observed_at: `${m[1]}-${quarterEndMonth}`,
      value: v,
      unit: "index_2010_100",
      source_key: "bis",
      source_tier: 1,
      frequency: "quarterly",
    });
  }
  if (points.length === 0) throw new Error("BIS residential property prices (India): no data parsed from response");
  return points;
}

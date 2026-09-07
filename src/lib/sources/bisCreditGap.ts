import type { MetricPoint } from "../metrics/store";

/**
 * China Credit-to-GDP Gap, from the BIS (Bank for International Settlements)
 * Total Credit statistics — free, no-auth, no-key SDMX REST API at
 * stats.bis.org. Dataflow WS_CREDIT_GAP, key
 * `Q.CN.P.A.C` = Quarterly, China, Private non-financial sector borrowers,
 * All-sector lenders, credit-to-GDP Gap (actual minus long-run HP-filter
 * trend) — the exact BIS/Basel III countercyclical-capital-buffer signal,
 * i.e. the standard central-bank early-warning indicator for a credit boom.
 *
 * This is used here as the practical, free, officially-published stand-in
 * for "China credit impulse": a literal Biggs-Mayer-Pick credit impulse
 * (second derivative of PBOC Total Social Financing flow, scaled by GDP)
 * would require deriving a growth-of-growth-rate metric ourselves from raw
 * flow data — more fabrication-adjacent than consuming BIS's own official,
 * already-computed series. The engine surfaces this honestly as a "BIS-based
 * proxy", not as a literal replica of any one bank's proprietary credit
 * impulse calculation.
 */
export async function fetchChinaCreditGap(): Promise<MetricPoint[]> {
  const url = "https://stats.bis.org/api/v1/data/BIS,WS_CREDIT_GAP,1.0/Q.CN.P.A.C?format=csv&startPeriod=2000";
  const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BIS credit-to-GDP gap: HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (periodIdx === -1 || valueIdx === -1) throw new Error("BIS credit-to-GDP gap: unexpected CSV header");

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
      metric_key: "china.credit_impulse",
      observed_at: `${m[1]}-${quarterEndMonth}`,
      value: v,
      unit: "pp of GDP (gap)",
      source_key: "bis",
      source_tier: 1,
      frequency: "quarterly",
    });
  }
  if (points.length === 0) throw new Error("BIS credit-to-GDP gap: no data parsed from response");
  return points;
}

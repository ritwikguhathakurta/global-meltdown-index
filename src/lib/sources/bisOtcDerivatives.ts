import type { MetricPoint } from "../metrics/store";

/**
 * BIS semiannual OTC derivatives statistics — free, no-auth SDMX REST API at stats.bis.org,
 * dataflow WS_OTC_DERIV2. This is the actual §6-7 "OTC derivatives outstanding: notional amounts,
 * gross market value, by risk category" ask, at the one cross-cut BIS genuinely publishes cleanly:
 * total notional outstanding, worldwide, all counterparties, all currencies, all instruments, net-net
 * reporting basis (the standard headline BIS uses in its own quarterly review), by risk category.
 *
 * Verified live before building this (dimension order + total codes are undocumented in BIS's own
 * data-browser UI, so every code below was resolved directly against the SDMX codelists, not
 * guessed): key is FREQ.DER_TYPE.DER_INSTR.DER_RISK.DER_REP_CTY.DER_SECTOR_CPY.DER_CPC.
 * DER_SECTOR_UDL.DER_CURR_LEG1.DER_CURR_LEG2.DER_ISSUE_MAT.DER_RATING.DER_EX_METHOD.DER_BASIS.
 * DER_TYPE=A is "Outstanding - notional amounts" (CL_OD_TYPE); DER_INSTR=A is "Total (all
 * instruments)"; DER_REP_CTY/DER_CPC=5J is "All countries"; DER_SECTOR_CPY/DER_SECTOR_UDL=A is
 * "Total (all counterparties)"; DER_CURR_LEG1/2=TO1 is the all-currencies total; DER_ISSUE_MAT/
 * DER_RATING=A are totals; DER_EX_METHOD=3 is "Total (all methods)"; DER_BASIS=C ("Net-net") is
 * the basis that actually carries the "all instruments" total row — confirmed the headline
 * DER_RISK=A/all-risk figure (~$845tn for 2025-S2) matches BIS's own published aggregate, and
 * DER_RISK=D (interest rate, ~$670tn) and DER_RISK=B (FX, ~$115tn) both fall in their well-known
 * real-world ranges, so this combination is the correct one, not an artifact.
 *
 * DER_TYPE=B ("Gross positive market values") was checked directly against this exact same
 * cross-cut (all instruments/counterparties/currencies) and genuinely does not exist in BIS's
 * published cube at any historical period back to 2015 — BIS only publishes gross market value
 * broken down BY instrument, never aggregated to "all instruments" the way notional is. Rather than
 * summing instrument-level market-value rows myself (a derived aggregate BIS itself doesn't
 * publish, which risks double-counting across overlapping instrument categories like "Forwards and
 * swaps" vs. its own sub-components), this is disclosed as UNAVAILABLE rather than approximated.
 *
 * BIS's exchange-traded derivatives dataflow (WS_XTD_DERIV) was also checked: unlike OTC, it is
 * reported per-currency/per-exchange with no published "all currencies/all exchanges" total row,
 * so a global figure would require summing across ~20 currencies and 7 exchange groups client-side.
 * Deferred rather than built as a first pass — a genuine gap, not an oversight.
 */
const BASE_URL = "https://stats.bis.org/api/v1/data/BIS,WS_OTC_DERIV2,1.0";

const RISK_CATEGORIES: Record<string, { code: string; metricKey: string; label: string }> = {
  total: { code: "A", metricKey: "derivatives.bis_otc_notional.total", label: "Total (all risk categories)" },
  fx: { code: "B", metricKey: "derivatives.bis_otc_notional.fx", label: "Foreign exchange" },
  rates: { code: "D", metricKey: "derivatives.bis_otc_notional.rates", label: "Interest rate" },
  equity: { code: "E", metricKey: "derivatives.bis_otc_notional.equity", label: "Equity" },
  commodity: { code: "J", metricKey: "derivatives.bis_otc_notional.commodity", label: "Commodities" },
  credit: { code: "T", metricKey: "derivatives.bis_otc_notional.credit", label: "Credit derivatives" },
};

export const BIS_OTC_RISK_CATEGORIES = RISK_CATEGORIES;

function parsePeriod(period: string): string | null {
  const m = period.match(/^(\d{4})-S([12])$/);
  if (!m) return null;
  return m[2] === "1" ? `${m[1]}-06-30` : `${m[1]}-12-31`;
}

export async function fetchBisOtcDerivativesNotional(): Promise<MetricPoint[]> {
  const riskCodes = Object.values(RISK_CATEGORIES)
    .map((r) => r.code)
    .join("+");
  const key = `H.A.A.${riskCodes}.5J.A.5J.A.TO1.TO1.A.A.3.C`;
  const url = `${BASE_URL}/${key}?format=csv&startPeriod=2000`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BIS OTC derivatives notional: HTTP ${res.status}`);
  const csv = await res.text();
  if (csv.trim().startsWith("<?xml") || csv.includes("<message:Error")) {
    throw new Error("BIS OTC derivatives notional: no data returned");
  }

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const riskIdx = header.indexOf("DER_RISK");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  const unitMultIdx = header.indexOf("UNIT_MULT");
  if (riskIdx === -1 || periodIdx === -1 || valueIdx === -1) {
    throw new Error("BIS OTC derivatives notional: unexpected CSV header");
  }

  const byCode = new Map(Object.values(RISK_CATEGORIES).map((r) => [r.code, r]));
  const points: MetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const risk = byCode.get(cols[riskIdx]);
    const observedAt = parsePeriod(cols[periodIdx]);
    const raw = parseFloat(cols[valueIdx]);
    const unitMult = unitMultIdx >= 0 ? Number(cols[unitMultIdx]) || 0 : 6;
    if (!risk || !observedAt || Number.isNaN(raw)) continue;
    points.push({
      metric_key: risk.metricKey,
      observed_at: observedAt,
      value: raw * 10 ** unitMult,
      unit: "USD",
      source_key: "bis_otc_derivatives",
      source_tier: 1,
      // The freshness classifier has no "semiannual" bucket; "quarterly" is the closer
      // approximation of the two available (errs toward flagging STALE sooner, not later).
      frequency: "quarterly",
    });
  }
  if (points.length === 0) throw new Error("BIS OTC derivatives notional: no data parsed from response");
  return points;
}

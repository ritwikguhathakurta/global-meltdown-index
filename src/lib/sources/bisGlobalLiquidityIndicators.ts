import type { MetricPoint } from "../metrics/store";

/**
 * BIS Global Liquidity Indicators (GLI) — free, no-key, no-auth SDMX REST API
 * at stats.bis.org, dataflow WS_GLI. This is the exact series the spec's own
 * "BIS Global Liquidity Engine" section calls out by name: "The BIS Global
 * Liquidity Indicators specifically measure foreign-currency credit to
 * non-bank borrowers through bank loans and international debt securities
 * and should form a major input into the Global Liquidity Engine."
 *
 * Verified live directly against the API before wiring in (not assumed from
 * documentation): dataflow WS_GLI(1.0), datastructure BIS_GLI, dimensions in
 * order FREQ.CURR_DENOM.BORROWERS_CTY.BORROWERS_SECTOR.LENDERS_SECTOR.
 * L_POS_TYPE.L_INSTR.UNIT_MEASURE.TIME_PERIOD.
 *
 * BORROWERS_CTY = "3P" ("All countries excluding residents") is BIS's own
 * headline aggregate for "credit to non-bank borrowers located OUTSIDE the
 * currency's home jurisdiction" — i.e. genuinely the "USD credit to non-US
 * non-banks" / "EUR credit to non-euro-area non-banks" / "JPY credit to
 * non-Japan non-banks" concept, not something computed or approximated here.
 * BORROWERS_CTY = "4T" ("Emerging market and developing economies") is BIS's
 * own EMDE aggregate — the EM-specific slice of the same USD series (spec
 * §157 "EM Dollar Liquidity").
 *
 * Two flavors exist at the same key with different UNIT_MEASURE: a level (in
 * millions of the denominating currency, UNIT_MEASURE = the currency code)
 * and a year-on-year growth rate (UNIT_MEASURE = "771", %). This connector
 * fetches the GROWTH RATE flavor specifically — spec §15 asks for "Dollar
 * Credit Growth: YoY" directly, and a growth rate is already correctly
 * detrended (a $14tn level doesn't z-score meaningfully against its own
 * history the way a YoY growth rate does) and is what spec §16's "Dollar
 * Liquidity Acceleration" (current growth minus historical growth; rapid
 * contraction = early warning) is built to read.
 *
 * BORROWERS_SECTOR = "N" (non-bank), LENDERS_SECTOR = "A" (all sectors),
 * L_POS_TYPE = "I" (international, i.e. cross-border), L_INSTR = "B" (bank
 * loans + debt securities combined — the "credit" aggregate, not just loans
 * or just securities alone) — all confirmed present and fresh (through
 * 2026-Q1 as of this addition) for USD/EUR/JPY at "3P" and for USD at "4T".
 */

async function fetchGliGrowth(currDenom: string, borrowersCty: string, metricKey: string): Promise<MetricPoint[]> {
  const url = `https://stats.bis.org/api/v1/data/BIS,WS_GLI,1.0/Q.${currDenom}.${borrowersCty}.N.A.I.B.771?format=csv&startPeriod=2000`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BIS GLI (${currDenom}.${borrowersCty}): HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (periodIdx === -1 || valueIdx === -1) throw new Error(`BIS GLI (${currDenom}.${borrowersCty}): unexpected CSV header`);

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
      metric_key: metricKey,
      observed_at: `${m[1]}-${quarterEndMonth}`,
      value: v,
      unit: "% YoY",
      source_key: "bis",
      source_tier: 1,
      frequency: "quarterly",
    });
  }
  if (points.length === 0) throw new Error(`BIS GLI (${currDenom}.${borrowersCty}): no data parsed from response`);
  return points;
}

/** USD-denominated credit to non-bank borrowers located outside the US — the
 * BIS's own headline "global dollar liquidity" growth series. */
export async function fetchGlobalUsdCreditGrowth(): Promise<MetricPoint[]> {
  return fetchGliGrowth("USD", "3P", "liquidity.global_usd_credit_growth_ex_us");
}

/** EUR-denominated credit to non-bank borrowers located outside the euro area. */
export async function fetchGlobalEurCreditGrowth(): Promise<MetricPoint[]> {
  return fetchGliGrowth("EUR", "3P", "liquidity.global_eur_credit_growth_ex_euro_area");
}

/** JPY-denominated credit to non-bank borrowers located outside Japan. */
export async function fetchGlobalJpyCreditGrowth(): Promise<MetricPoint[]> {
  return fetchGliGrowth("JPY", "3P", "liquidity.global_jpy_credit_growth_ex_japan");
}

/** USD-denominated credit to non-bank borrowers located in emerging market
 * and developing economies specifically — the EM-focused slice (spec §157). */
export async function fetchEmUsdCreditGrowth(): Promise<MetricPoint[]> {
  return fetchGliGrowth("USD", "4T", "liquidity.em_usd_credit_growth");
}

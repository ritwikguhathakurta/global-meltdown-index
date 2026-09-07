import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";

/**
 * Per-country FX-stress table for the Emerging-Market Debt dashboard, mirroring
 * the same "one row per real-world unit, disclosed basis, z-score regime"
 * pattern as liquidityRegime.ts / creditRegime.ts. The EM Debt engine
 * (emergingMarketDebt.ts) blends a subset of this into one composite score;
 * this module exposes the full country breakout.
 *
 * Basis: USD/local-currency exchange rate, not a sovereign bond spread.
 * JPMorgan's EMBI (the standard EM sovereign dollar-bond spread index) is a
 * paid, proprietary benchmark — no free per-country equivalent was found.
 * FX is used instead because it is the actual transmission channel this
 * engine's own trigger describes: EM issuers with dollar-denominated debt
 * face a rising local-currency cost of debt service as their currency
 * weakens, and a weakening currency also makes rolling that debt at maturity
 * more expensive. Regime bands are the same 0-20/20-40/40-60/60-80/80-100
 * z-score scale and label set as the composite engine below.
 *
 * Country set: the MSCI Emerging Markets constituents the ECB itself
 * publishes a daily reference rate for (via Frankfurter — see fx.ts).
 * Several other prominent EM debt issuers (Taiwan, Chile, Colombia, Peru,
 * Saudi Arabia, UAE, Qatar, Kuwait) are MSCI EM members too but have no free
 * daily FX source found yet, so they are not included — not silently
 * dropped, disclosed on the dashboard page.
 */

export type EmDebtRegimeLabel = "AMPLE_ACCESS" | "NORMAL" | "TIGHTENING" | "FUNDING_STRESS" | "SUDDEN_STOP" | "INSUFFICIENT_DATA";

function regimeFromZ(z: number | null): EmDebtRegimeLabel {
  if (z === null) return "INSUFFICIENT_DATA";
  const clamped = Math.max(-3, Math.min(3, z));
  const score = ((clamped + 3) / 6) * 100;
  if (score < 20) return "AMPLE_ACCESS";
  if (score < 40) return "NORMAL";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "FUNDING_STRESS";
  return "SUDDEN_STOP";
}

export type CountryEmDebtRow = {
  country: string;
  fxPair: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  regime: EmDebtRegimeLabel;
};

async function loadSeries(db: SupabaseClient, key: string): Promise<Point[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
  return fetchSeries(db, key, since.toISOString());
}

function latest(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

function fxRow(country: string, fxPair: string, series: Point[], unit: string): CountryEmDebtRow {
  const regime = regimeFromZ(zScore(series, 252));
  const last = latest(series);
  return { country, fxPair, value: last?.v ?? null, unit, asOf: last?.t ?? null, regime };
}

const COUNTRIES: { country: string; metricKey: string; fxPair: string; unit: string }[] = [
  { country: "Brazil", metricKey: "fx.usdbrl", fxPair: "USD/BRL", unit: "BRL" },
  { country: "Mexico", metricKey: "fx.usdmxn", fxPair: "USD/MXN", unit: "MXN" },
  { country: "South Africa", metricKey: "fx.usdzar", fxPair: "USD/ZAR", unit: "ZAR" },
  { country: "Turkey", metricKey: "fx.usdtry", fxPair: "USD/TRY", unit: "TRY" },
  { country: "India", metricKey: "fx.usdinr", fxPair: "USD/INR", unit: "INR" },
  { country: "Indonesia", metricKey: "fx.usdidr", fxPair: "USD/IDR", unit: "IDR" },
  { country: "China", metricKey: "fx.usdcny", fxPair: "USD/CNY", unit: "CNY" },
  { country: "Philippines", metricKey: "fx.usdphp", fxPair: "USD/PHP", unit: "PHP" },
  { country: "Poland", metricKey: "fx.usdpln", fxPair: "USD/PLN", unit: "PLN" },
  { country: "Hungary", metricKey: "fx.usdhuf", fxPair: "USD/HUF", unit: "HUF" },
  { country: "Czech Republic", metricKey: "fx.usdczk", fxPair: "USD/CZK", unit: "CZK" },
  { country: "Thailand", metricKey: "fx.usdthb", fxPair: "USD/THB", unit: "THB" },
  { country: "Malaysia", metricKey: "fx.usdmyr", fxPair: "USD/MYR", unit: "MYR" },
  { country: "South Korea", metricKey: "fx.usdkrw", fxPair: "USD/KRW", unit: "KRW" },
];

export async function getCountryEmDebtTable(db: SupabaseClient): Promise<CountryEmDebtRow[]> {
  const series = await Promise.all(COUNTRIES.map((c) => loadSeries(db, c.metricKey)));
  return COUNTRIES.map((c, i) => fxRow(c.country, c.fxPair, series[i], c.unit));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries, fetchLatestForKeys } from "../metrics/store";
import { zScore, zToRiskScore, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { EM_DEBT_COUNTRIES } from "../sources/worldBankEmDebt";

/**
 * EM Debt Systemic Risk — per-country structural + market vulnerability model,
 * replacing the earlier FX-only version. Rebuilt after a detailed institutional
 * spec (76 sections: sovereign solvency, rollover risk, CDS, capital flows,
 * foreign ownership, sovereign-bank nexus, corporate FX debt, contagion,
 * backtesting, an AI agent, a world map, etc.) was checked component-by-component
 * against what free, verified data actually supports. What's built here is the
 * genuinely free-data-backed subset; everything else is disclosed as deferred
 * rather than faked — see the methodology page for the full breakdown.
 *
 * STRUCTURAL side (World Bank Open Data API — free, no key, verified live):
 * government debt/GDP, external debt/GNI, external debt service/exports,
 * short-term external debt/reserves (a real rollover-risk proxy — e.g. Turkey's
 * own 2024 figure exceeds 100%, meaning short-term FX obligations exceed total
 * reserves), reserve adequacy (months of imports), current account/GDP, real GDP
 * growth, and fiscal balance/GDP (real but with genuine per-country gaps in WDI —
 * left UNAVAILABLE where missing, never estimated). These are annual, cross-
 * sectionally z-scored against the tracked EM peer set at each observation
 * (spec's own instruction: "do not use universal debt/GDP thresholds... use peer
 * groups"), not against each country's own history (an annual series never
 * accumulates the ~20 points a time-series z-score needs).
 *
 * MARKET side: this engine's own FX time-series z-score (unchanged mechanism
 * from before, own 252-day history) blended with a sovereign CDS reading from
 * Damodaran/NYU Stern's free annual snapshot (see sovereignRiskPremium.ts) —
 * disclosed there as a single point-in-time value, not a live feed, so no
 * "CDS acceleration" signal is computed (there is nothing to accelerate from
 * one snapshot).
 *
 * NOT built — no free/reliable source found, disclosed rather than faked:
 * foreign ownership of local bonds (IMF CPIS/PIP exists but is annual with
 * known reporting gaps among major non-Western EM creditors), capital-flow
 * data (EPFR/IIF, paid), sovereign-bank nexus, corporate external debt by
 * hedge status, auction-level stress, a world map / maturity-wall UI, an AI
 * chat agent, and backtesting against historical crises (would need the
 * unavailable market/flow data as historical input).
 */

export type EmDebtRegimeLabel = "AMPLE_ACCESS" | "NORMAL" | "TIGHTENING" | "FUNDING_STRESS" | "SUDDEN_STOP" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): EmDebtRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "AMPLE_ACCESS";
  if (score < 40) return "NORMAL";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "FUNDING_STRESS";
  return "SUDDEN_STOP";
}

export type StructuralIndicatorDef = {
  suffix: string;
  label: string;
  unit: string;
  /** 1 = a higher raw value means higher risk; -1 = a lower raw value means higher risk. */
  direction: 1 | -1;
  weight: number;
};

export const STRUCTURAL_INDICATORS: StructuralIndicatorDef[] = [
  { suffix: "govt_debt_to_gdp", label: "Government Debt / GDP", unit: "%", direction: 1, weight: 1.0 },
  { suffix: "external_debt_to_gni", label: "External Debt / GNI", unit: "%", direction: 1, weight: 1.0 },
  { suffix: "external_debt_service_to_exports", label: "External Debt Service / Exports", unit: "%", direction: 1, weight: 0.9 },
  { suffix: "short_term_debt_to_reserves", label: "Short-Term External Debt / Reserves", unit: "%", direction: 1, weight: 1.1 },
  { suffix: "reserves_months_imports", label: "Reserve Adequacy", unit: "months of imports", direction: -1, weight: 0.8 },
  { suffix: "current_account_to_gdp", label: "Current Account / GDP", unit: "%", direction: -1, weight: 0.8 },
  { suffix: "real_gdp_growth", label: "Real GDP Growth", unit: "%", direction: -1, weight: 0.6 },
  { suffix: "fiscal_balance_to_gdp", label: "Fiscal Balance / GDP", unit: "%", direction: -1, weight: 0.9 },
];

const FX_METRIC_KEY: Record<string, string> = {
  brazil: "fx.usdbrl", mexico: "fx.usdmxn", south_africa: "fx.usdzar", turkey: "fx.usdtry",
  india: "fx.usdinr", indonesia: "fx.usdidr", china: "fx.usdcny", philippines: "fx.usdphp",
  poland: "fx.usdpln", hungary: "fx.usdhuf", czech_republic: "fx.usdczk", thailand: "fx.usdthb",
  malaysia: "fx.usdmyr", south_korea: "fx.usdkrw",
};

const FX_PAIR_LABEL: Record<string, string> = {
  brazil: "USD/BRL", mexico: "USD/MXN", south_africa: "USD/ZAR", turkey: "USD/TRY",
  india: "USD/INR", indonesia: "USD/IDR", china: "USD/CNY", philippines: "USD/PHP",
  poland: "USD/PLN", hungary: "USD/HUF", czech_republic: "USD/CZK", thailand: "USD/THB",
  malaysia: "USD/MYR", south_korea: "USD/KRW",
};

export type IndicatorReading = { value: number | null; asOf: string | null; score: number | null };

export type CountryEmDebtRow = {
  country: string;
  fx: { pair: string; value: number | null; asOf: string | null; score: number | null };
  structural: Record<string, IndicatorReading>;
  sovereignCds: IndicatorReading;
  structuralScore: number | null;
  marketScore: number | null;
  vulnerabilityScore: number | null;
  regime: EmDebtRegimeLabel;
  /** Structural vulnerability elevated while market pricing (CDS/FX) is still calm — the spec's "latent risk," genuinely computed, not asserted. */
  latentRisk: boolean;
  /** Market pricing deteriorating faster than structural fundamentals — the spec's "market is already warning" case. */
  marketLedWarning: boolean;
  /** Fraction of the 8 structural indicators with real data for this country (WDI coverage varies — some upper-middle-income EMs are outside World Bank IDS's scope). */
  dataCompleteness: number;
};

async function loadFxSeries(db: SupabaseClient, metricKey: string): Promise<Point[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
  return fetchSeries(db, metricKey, since.toISOString());
}

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

/** Cross-sectional z-score across EM peers at their latest observation — the
 * only sensible basis for annual structural data (a country's own history
 * never accumulates enough annual points for a time-series z-score), and
 * exactly what "peer-group, not universal, thresholds" requires. */
function crossSectionalZ(values: Map<string, number>): Map<string, number> {
  const z = new Map<string, number>();
  const arr = Array.from(values.values());
  if (arr.length < 4) return z; // too few peers with data for a meaningful comparison
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const sd = Math.sqrt(variance);
  for (const [k, v] of values) z.set(k, sd > 0 ? (v - mean) / sd : 0);
  return z;
}

export async function getCountryEmDebtTable(db: SupabaseClient): Promise<CountryEmDebtRow[]> {
  const fxSeriesByCountry = await Promise.all(
    EM_DEBT_COUNTRIES.map((c) => loadFxSeries(db, FX_METRIC_KEY[c.key]))
  );

  const structuralKeys = EM_DEBT_COUNTRIES.flatMap((c) => STRUCTURAL_INDICATORS.map((ind) => `emdebt.${c.key}.${ind.suffix}`));
  const cdsKeys = EM_DEBT_COUNTRIES.map((c) => `emdebt.${c.key}.sovereign_cds_10y`);
  const latest = await fetchLatestForKeys(db, [...structuralKeys, ...cdsKeys]);

  const zByIndicator = new Map<string, Map<string, number>>();
  for (const ind of STRUCTURAL_INDICATORS) {
    const values = new Map<string, number>();
    for (const c of EM_DEBT_COUNTRIES) {
      const row = latest.get(`emdebt.${c.key}.${ind.suffix}`);
      if (row) values.set(c.key, row.v);
    }
    zByIndicator.set(ind.suffix, crossSectionalZ(values));
  }

  const cdsValues = new Map<string, number>();
  for (const c of EM_DEBT_COUNTRIES) {
    const row = latest.get(`emdebt.${c.key}.sovereign_cds_10y`);
    if (row) cdsValues.set(c.key, row.v);
  }
  const cdsZ = crossSectionalZ(cdsValues);

  return EM_DEBT_COUNTRIES.map((c, i) => {
    const fxSeries = fxSeriesByCountry[i];
    const fxZ = zScore(fxSeries, 252);
    const fxScore = zToRiskScore(fxZ, 1);
    const fxLast = latestPoint(fxSeries);

    const structural: Record<string, IndicatorReading> = {};
    let structuralWeightSum = 0;
    let structuralScoreSum = 0;
    let structuralAvailable = 0;
    for (const ind of STRUCTURAL_INDICATORS) {
      const row = latest.get(`emdebt.${c.key}.${ind.suffix}`);
      const z = row ? zByIndicator.get(ind.suffix)?.get(c.key) ?? null : null;
      const score = z !== null && z !== undefined ? zToRiskScore(z, ind.direction) : null;
      structural[ind.suffix] = { value: row?.v ?? null, asOf: row?.t ?? null, score };
      if (score !== null) {
        structuralScoreSum += score * ind.weight;
        structuralWeightSum += ind.weight;
        structuralAvailable++;
      }
    }
    const structuralScore = structuralWeightSum > 0 ? Math.round(structuralScoreSum / structuralWeightSum) : null;

    const cdsRow = latest.get(`emdebt.${c.key}.sovereign_cds_10y`);
    const cdsZv = cdsRow ? cdsZ.get(c.key) ?? null : null;
    const cdsScore = cdsZv !== null && cdsZv !== undefined ? zToRiskScore(cdsZv, 1) : null;

    const marketParts = [cdsScore, fxScore].filter((s): s is number => s !== null);
    const marketScore = marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b, 0) / marketParts.length) : null;

    const vulnerabilityParts: { score: number; weight: number }[] = [];
    if (structuralScore !== null) vulnerabilityParts.push({ score: structuralScore, weight: 0.6 });
    if (marketScore !== null) vulnerabilityParts.push({ score: marketScore, weight: 0.4 });
    const vulnerabilityWeightSum = vulnerabilityParts.reduce((a, b) => a + b.weight, 0);
    const vulnerabilityScore =
      vulnerabilityWeightSum > 0
        ? Math.round(vulnerabilityParts.reduce((a, b) => a + b.score * b.weight, 0) / vulnerabilityWeightSum)
        : null;

    const dataCompleteness = Math.round((structuralAvailable / STRUCTURAL_INDICATORS.length) * 100) / 100;
    const latentRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;

    return {
      country: c.name,
      fx: { pair: FX_PAIR_LABEL[c.key], value: fxLast?.v ?? null, asOf: fxLast?.t ?? null, score: fxScore },
      structural,
      sovereignCds: { value: cdsRow?.v ?? null, asOf: cdsRow?.t ?? null, score: cdsScore },
      structuralScore,
      marketScore,
      vulnerabilityScore,
      regime: labelFromScore(vulnerabilityScore),
      latentRisk,
      marketLedWarning,
      dataCompleteness,
    };
  });
}

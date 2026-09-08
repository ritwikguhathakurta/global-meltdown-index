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
 * STRUCTURAL side (10 cross-sectionally z-scored indicators, annual/quarterly,
 * scored against the tracked EM peer set at each observation — the spec's own
 * instruction: "do not use universal debt/GDP thresholds... use peer groups";
 * also the only sensible basis anyway, since these series never accumulate the
 * ~20 points a time-series z-score needs):
 *  - World Bank Open Data API (free, no key): government debt/GDP, external
 *    debt/GNI, external debt service/exports, short-term external debt/
 *    reserves (a real rollover-risk proxy — e.g. Turkey's own 2024 figure
 *    exceeds 100%, short-term FX obligations exceeding total reserves),
 *    reserve adequacy (months of imports), current account/GDP, real GDP
 *    growth, fiscal balance/GDP (genuine per-country WDI gaps — left
 *    UNAVAILABLE where missing, never estimated).
 *  - BIS International Debt Securities (free, no key, verified live):
 *    corporate FX debt/GDP — non-financial-corporate foreign-currency
 *    international bond issuance outstanding, divided by World Bank GDP.
 *    A partial (bond-market-only) proxy for total corporate FX exposure,
 *    disclosed as such — not FX bank loans or domestic FX issuance.
 *  - IMF Portfolio Investment Positions / PIP, formerly CPIS (free, no key,
 *    verified live): year-over-year change in aggregate foreign holdings of
 *    local debt securities, summed across whichever of ~65-75 voluntary
 *    reporting economies actually submitted data for the target country.
 *    Using the YoY change rather than the level makes this far more robust
 *    to a persistently-incomplete reporter set (the same gap in both years
 *    being compared) than the previously-assumed-unusable raw level.
 *
 * MARKET side: this engine's own FX time-series z-score (own 252-day
 * history) blended with a sovereign CDS reading from Damodaran/NYU Stern's
 * free annual snapshot (see sovereignRiskPremium.ts) — disclosed there as a
 * single point-in-time value, not a live feed, so no "CDS acceleration"
 * signal is computed (there is nothing to accelerate from one snapshot).
 *
 * STILL NOT built — checked, no free/reliable source found, disclosed
 * rather than faked: capital-flow data beyond the PIP proxy above (EPFR/IIF
 * fund flows are paid), a true domestic sovereign-bank nexus (IMF FSI's
 * "sectoral distribution of investments: central government" indicator was
 * checked live and returns no populated series for any of the 14 tracked
 * countries), auction-level stress (would need ~14 separate national
 * debt-office integrations), a world map / maturity-wall UI, an AI chat
 * agent, and backtesting against historical crises.
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

/**
 * 7-stage crisis staging (spec's own "Stage 1: Early Warning" -> "Stage 7:
 * Default/Restructuring" framework), built on top of the same 0-100
 * vulnerability score rather than as a separately-detected regime — there is
 * no free data source that observes an actual default/restructuring event,
 * so Stage 7 is disclosed honestly as "the top of what this model can
 * measure," not a confirmed default. Stages 2 and 4 are also promoted (never
 * demoted) by the two flags this engine already computes for real
 * (latentRisk, marketLedWarning), so a country whose structural fundamentals
 * are deteriorating ahead of the market is never shown at Stage 1, and one
 * whose market pricing is already running ahead of fundamentals is never
 * shown below Stage 4 — the same logic used for those flags elsewhere in
 * this file, just mapped onto the finer 7-band scale the spec asked for.
 */
export type CrisisStageKey =
  | "STABLE"
  | "EARLY_WARNING"
  | "ELEVATED_VULNERABILITY"
  | "MARKET_REPRICING"
  | "FUNDING_STRESS"
  | "SUDDEN_STOP"
  | "ACUTE_CRISIS";

export type CrisisStageDef = {
  stage: number; // 1-7
  key: CrisisStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const CRISIS_STAGES: CrisisStageDef[] = [
  {
    stage: 1,
    key: "STABLE",
    label: "Stage 1 — Stable",
    shortLabel: "Stable",
    description: "Ample market access; structural fundamentals and market pricing are both calm.",
  },
  {
    stage: 2,
    key: "EARLY_WARNING",
    label: "Stage 2 — Early Warning",
    shortLabel: "Early Warning",
    description: "Structural fundamentals deteriorating while market pricing (FX, sovereign CDS) has not reacted yet — genuinely computed latent risk, not asserted.",
  },
  {
    stage: 3,
    key: "ELEVATED_VULNERABILITY",
    label: "Stage 3 — Elevated Vulnerability",
    shortLabel: "Elevated Vulnerability",
    description: "Structural and market readings are both moderately elevated together.",
  },
  {
    stage: 4,
    key: "MARKET_REPRICING",
    label: "Stage 4 — Market Repricing",
    shortLabel: "Market Repricing",
    description: "Market pricing (currency, sovereign CDS) moving materially faster than structural fundamentals — the market has already started pricing in stress.",
  },
  {
    stage: 5,
    key: "FUNDING_STRESS",
    label: "Stage 5 — Funding Stress",
    shortLabel: "Funding Stress",
    description: "Blended vulnerability score has crossed into the range where rollover and funding conditions are genuinely tightening.",
  },
  {
    stage: 6,
    key: "SUDDEN_STOP",
    label: "Stage 6 — Sudden Stop",
    shortLabel: "Sudden Stop",
    description: "Severe, broad-based deterioration across structural and market readings together, consistent with a capital-flight episode.",
  },
  {
    stage: 7,
    key: "ACUTE_CRISIS",
    label: "Stage 7 — Acute Crisis",
    shortLabel: "Acute Crisis",
    description: "The top of the observed stress range on this engine's 0-100 scale. This is a score band, not a confirmed default or restructuring event — no free data source can observe an actual default, so treat this as 'as severe as this model can measure,' not as proof of default.",
  },
];

function stageNumberFromScore(score: number): number {
  if (score < 15) return 1;
  if (score < 30) return 2;
  if (score < 45) return 3;
  if (score < 60) return 4;
  if (score < 75) return 5;
  if (score < 90) return 6;
  return 7;
}

export function crisisStageFor(
  vulnerabilityScore: number | null,
  latentRisk: boolean,
  marketLedWarning: boolean
): CrisisStageDef | null {
  if (vulnerabilityScore === null) return null;
  let stage = stageNumberFromScore(vulnerabilityScore);
  if (latentRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 4);
  return CRISIS_STAGES[stage - 1];
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

/** Computed (not directly fetched) structural indicators — see the file-level
 * comment for what each is derived from. Kept separate from STRUCTURAL_INDICATORS
 * only because their raw values require combining two metric keys or a
 * multi-year lookback rather than a single `latest.get(suffix)` read; they are
 * scored, weighted and blended into structuralScore identically. */
export const COMPUTED_STRUCTURAL_INDICATORS: StructuralIndicatorDef[] = [
  { suffix: "corporate_fx_debt_to_gdp", label: "Corporate FX Debt (Int'l Bonds) / GDP", unit: "%", direction: 1, weight: 0.8 },
  { suffix: "foreign_holdings_yoy_pct", label: "Foreign Holdings of Debt Securities, YoY", unit: "% change", direction: -1, weight: 0.7 },
];

const ALL_STRUCTURAL_INDICATORS: StructuralIndicatorDef[] = [...STRUCTURAL_INDICATORS, ...COMPUTED_STRUCTURAL_INDICATORS];

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
  /** Fraction of the 10 structural indicators with real data for this country (WDI/BIS/IMF PIP coverage all vary — some upper-middle-income EMs are outside World Bank IDS's scope, some countries have thin BIS international-bond issuance, some have few PIP reporters). */
  dataCompleteness: number;
  /** 1-7 crisis stage (spec's staging framework), derived from vulnerabilityScore + the two flags above. Null only when vulnerabilityScore itself is null. */
  crisisStage: number | null;
  crisisStageLabel: string;
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

/** Latest two annual points' % change — used for the foreign-holdings YoY
 * signal, which needs real multi-year history (fetchLatestForKeys only
 * returns one point per key), not a cross-sectional snapshot. */
function latestYoyPct(points: Point[]): { value: number; asOf: string } | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const prior = sorted[sorted.length - 2];
  if (prior.v === 0) return null;
  return { value: ((latest.v - prior.v) / Math.abs(prior.v)) * 100, asOf: latest.t };
}

export async function getCountryEmDebtTable(db: SupabaseClient): Promise<CountryEmDebtRow[]> {
  const fxSeriesByCountry = await Promise.all(
    EM_DEBT_COUNTRIES.map((c) => loadFxSeries(db, FX_METRIC_KEY[c.key]))
  );

  const structuralKeys = EM_DEBT_COUNTRIES.flatMap((c) => STRUCTURAL_INDICATORS.map((ind) => `emdebt.${c.key}.${ind.suffix}`));
  const cdsKeys = EM_DEBT_COUNTRIES.map((c) => `emdebt.${c.key}.sovereign_cds_10y`);
  const corpFxKeys = EM_DEBT_COUNTRIES.map((c) => `emdebt.${c.key}.corporate_fx_debt_usd`);
  const gdpKeys = EM_DEBT_COUNTRIES.map((c) => `emdebt.${c.key}.gdp_current_usd`);
  const latest = await fetchLatestForKeys(db, [...structuralKeys, ...cdsKeys, ...corpFxKeys, ...gdpKeys]);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("annual"));
  const foreignHoldingsSeriesByCountry = new Map(
    await Promise.all(
      EM_DEBT_COUNTRIES.map(
        async (c) => [c.key, await fetchSeries(db, `emdebt.${c.key}.foreign_holdings_debt_usd`, since.toISOString())] as const
      )
    )
  );

  // Raw value per indicator per country, unified across the 8 directly-fetched
  // World Bank indicators and the 2 computed ones (corporate FX debt/GDP,
  // foreign-holdings YoY) so the rest of this function can score all 10 the
  // same way instead of special-casing the computed ones.
  const rawValueByIndicator = new Map<string, Map<string, { value: number; asOf: string }>>();

  for (const ind of STRUCTURAL_INDICATORS) {
    const m = new Map<string, { value: number; asOf: string }>();
    for (const c of EM_DEBT_COUNTRIES) {
      const row = latest.get(`emdebt.${c.key}.${ind.suffix}`);
      if (row) m.set(c.key, { value: row.v, asOf: row.t });
    }
    rawValueByIndicator.set(ind.suffix, m);
  }

  {
    const m = new Map<string, { value: number; asOf: string }>();
    for (const c of EM_DEBT_COUNTRIES) {
      const corp = latest.get(`emdebt.${c.key}.corporate_fx_debt_usd`);
      const gdp = latest.get(`emdebt.${c.key}.gdp_current_usd`);
      if (corp && gdp && gdp.v > 0) m.set(c.key, { value: (corp.v / gdp.v) * 100, asOf: corp.t });
    }
    rawValueByIndicator.set("corporate_fx_debt_to_gdp", m);
  }

  {
    const m = new Map<string, { value: number; asOf: string }>();
    for (const c of EM_DEBT_COUNTRIES) {
      const yoy = latestYoyPct(foreignHoldingsSeriesByCountry.get(c.key) ?? []);
      if (yoy) m.set(c.key, yoy);
    }
    rawValueByIndicator.set("foreign_holdings_yoy_pct", m);
  }

  const zByIndicator = new Map<string, Map<string, number>>();
  for (const ind of ALL_STRUCTURAL_INDICATORS) {
    const values = new Map<string, number>();
    for (const [key, row] of rawValueByIndicator.get(ind.suffix) ?? []) values.set(key, row.value);
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
    for (const ind of ALL_STRUCTURAL_INDICATORS) {
      const row = rawValueByIndicator.get(ind.suffix)?.get(c.key) ?? null;
      const z = row ? zByIndicator.get(ind.suffix)?.get(c.key) ?? null : null;
      const score = z !== null && z !== undefined ? zToRiskScore(z, ind.direction) : null;
      structural[ind.suffix] = { value: row?.value ?? null, asOf: row?.asOf ?? null, score };
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

    const dataCompleteness = Math.round((structuralAvailable / ALL_STRUCTURAL_INDICATORS.length) * 100) / 100;
    const latentRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = crisisStageFor(vulnerabilityScore, latentRisk, marketLedWarning);

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
      crisisStage: stageDef?.stage ?? null,
      crisisStageLabel: stageDef?.shortLabel ?? "—",
    };
  });
}

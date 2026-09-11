import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, previousOf, subtractSeriesByDate, clamp, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { getBankingSystemicRiskTable } from "./bankingSystemicRisk";
import { getPropertySystemicRiskTable } from "./propertySystemicRisk";

/**
 * China Systemic Risk — built against a 96-section institutional spec
 * ("MacroSignal China Systemic Risk Engine": macro/deflation/fiscal/LGFV/
 * property/banking/shadow-banking/credit/monetary/FX/external/industrial/
 * provincial engines, a 100+-signal library, province-level risk maps, a
 * 15-scenario stress-test library with a user-facing policy simulator,
 * historical backtesting to 1997, a daily 8am IST report and full AI Q&A
 * layer...). Checked domain by domain against what free, verified data
 * genuinely supports for a single-country deep dive on top of an existing
 * app rather than a from-scratch platform — the same discipline already
 * applied to Banking/Property/Liquidity Systemic Risk and the Treasury Risk
 * engine.
 *
 * This deliberately does NOT touch the existing flat, GFMI-weighted "China"
 * engine (china.ts, still shown above this section on the China dashboard
 * page) — same "new analytical layer, not a second vote" pattern used by
 * every other *SystemicRisk.ts file in this app (spec's own §87 "Double
 * Counting Control" instruction, applied literally here).
 *
 * CROSS-ENGINE REUSE (spec §86, avoiding §87's double-counting trap): two of
 * the six structural domains below are NOT re-derived from raw series —
 * they read China's own already-computed row straight out of the existing
 * Banking Systemic Risk and Property Systemic Risk engines (China is
 * already a first-class member of both nine-country universes). This is
 * the literal single-country analogue of what the spec calls "Cross-Engine
 * Interactions": China's banking and property fragility are used here as
 * inputs, not recalculated a second, slightly-different way.
 *
 * Because this engine covers ONE country rather than a peer universe, the
 * "contagion breadth across peer countries" pattern every other
 * *SystemicRisk.ts file uses cannot apply directly. Spec §46 ("China
 * Convergence Engine": "the greater the independent convergence [across
 * Property + LGFV + Banks + Credit + Deflation + FX + External], the higher
 * the systemic risk") supplies the natural single-country substitute used
 * here instead: CONVERGENCE = the fraction of this China engine's OWN six
 * structural domains that are independently elevated (>=60) at the same
 * time. One bad domain in isolation barely moves this; several
 * independently-derived domains flashing red together does — the same
 * "single isolated signal must not trigger a systemic warning; multiple
 * independent signals converging should" principle spec §45 states
 * explicitly for its 100-signal library, applied here at domain granularity
 * instead of individual-signal granularity (a 100-signal library with
 * confidence/percentile/z-score/revision-status metadata per signal, per
 * spec §43, was not built this pass — six real, freely-verified domains
 * were, each already itself a blend of several genuine signals).
 *
 * SIX STRUCTURAL DOMAINS:
 *
 *  - PROPERTY (spec §9-10, 42 "Property" EWS group): blends (a) China's row
 *    from the existing Property Systemic Risk engine (its Valuation/Credit/
 *    Affordability/Market blend, unchanged) with (b) a locally-computed
 *    Activity score from two NBS-sourced flow series already ingested for
 *    the flat china.ts engine — property.sales (floor space sold) and
 *    developer_financing (real-estate development investment YoY) — since
 *    neither of those transaction/investment flows feeds the Property
 *    Systemic Risk engine's own valuation-focused domains. Declining
 *    sales/investment scores as risk, not "valuation excess," reflecting
 *    China's actual current property problem (a demand/financing
 *    collapse) rather than the overheating framing that domain uses for
 *    most other tracked countries.
 *  - BANKING (spec §11-12, 41 "Banking" EWS group): China's own composite
 *    score straight from the existing Banking Systemic Risk engine
 *    (Capital/Credit/Funding/Liquidity/Market blend) — read, not
 *    recomputed.
 *  - FISCAL / LGFV (spec §7-8, 37 "China Shadow Fiscal Deficit Engine"):
 *    the IMF Article IV "Augmented Debt" (general government debt plus
 *    LGFV/off-budget activity) annual series already ingested for the flat
 *    china.ts engine (china.lgfv_debt). Only ~6 annual observations exist
 *    (2020-2025) — far below the 20-point minimum this app's own zScore()
 *    helper requires for a meaningful own-history baseline — so this domain
 *    is NOT z-scored like the others. It instead uses a fixed, disclosed
 *    calibration band (60% of GDP = 0 risk, 160% = 100 risk, linear,
 *    clamped) anchored on the IMF's own historical range for this series
 *    (97.5% in 2020 to 126.6% in 2025) and standard 60%/90%/120% general
 *    debt-sustainability reference points used elsewhere in this app's
 *    Treasury/Debt engines — an explicit, disclosed methodology choice, not
 *    a fabricated data point (the underlying 126.6% figure is IMF's own).
 *  - DEFLATION (spec §6 "China Deflation Engine", one of the spec's most
 *    emphasized China-specific modules): year-on-year CPI inflation,
 *    computed locally from the same china.cpi_index level series already
 *    ingested for the flat engine (FRED/OECD MEI) — the flat engine only
 *    z-scores the raw index LEVEL, which does not actually capture
 *    deflation (a slowly-rising index is not deflationary even if it's
 *    below its own recent trend). This domain instead z-scores the
 *    computed YoY rate itself, scored as risk when YoY inflation is LOW or
 *    negative — not high, the opposite convention from every other
 *    inflation-risk indicator elsewhere in this app, and disclosed as such.
 *    A true PPI series was checked (FRED/OECD's CHNPIEATI01GYM) and found
 *    discontinued since December 2022 — not used, disclosed as a gap below,
 *    rather than fed a 4-year-stale reading.
 *  - EXTERNAL / FX (spec §18, 20-21 "RMB/FX", "FX Reserve", "External
 *    Balance" engines): blends three already-ingested series into one
 *    domain — CNY depreciation pressure (fx.usdcny, own-history), reserve
 *    trend (liquidity.china_reserves_ex_gold, SAFE's own monthly reserves-
 *    ex-gold figure), and the trade balance (china.exports_cny minus
 *    china.imports_cny, computed locally) — a shrinking/negative balance
 *    scored as risk alongside currency and reserve pressure.
 *  - LIQUIDITY / MONEY MARKET (spec §16-17 "Monetary Policy"/"PBOC
 *    Liquidity" engines): China's 3M interbank rate (china.interbank_rate_3m,
 *    the same SHIBOR-equivalent OECD MEI series used across this app's
 *    Banking/Property/Carry Trade engines for China), scored as risk when
 *    elevated relative to its own recent history (a funding-cost spike).
 *
 * MARKET: Shanghai Composite (equity.shanghai_composite) own-history price
 * z-score (60%, price below trend = stress) blended with realized-volatility
 * z-score (40%) — the identical construction already used by every sibling
 * *SystemicRisk.ts engine's own Market domain.
 *
 * STRUCTURAL = Property 25% + Banking 20% + Fiscal/LGFV 15% + Deflation 15%
 * + External/FX 15% + Liquidity 10% (weighted toward the property->bank->
 * LGFV->fiscal transmission chain spec §1 draws explicitly, the same
 * causal-chain emphasis behind this weighting).
 * COMPOSITE = Structural 40% + Market 35% + Convergence 25% (this app's
 * standard Structural/Market/Contagion-or-Convergence split, applied
 * verbatim).
 *
 * STAGE MODEL: spec's own 8-stage crisis clock (§67, Stage 0 Stable through
 * Stage 7 Systemic Contagion) compressed to this app's standard 7-stage
 * convention (Stage 0 folded into Stage 1, since both describe the same
 * "nothing elevated yet" state) — identical compression pattern already
 * used by Property/Banking/Carry Trade/Treasury Risk. Hidden China Risk
 * (spec §44: structural elevated, market still calm) and Market-Led Warning
 * (market deteriorating well ahead of structural) promote the stage floor,
 * never demote it — the same mechanism used everywhere else in this app.
 * Stage 7 is reserved for a genuinely high Convergence reading (most
 * structural domains elevated at once) alongside an already-high composite
 * — spec §45's "a single isolated signal must not trigger systemic warning;
 * multiple independent signals converging should," applied at domain
 * granularity since there is no country-breadth dimension for one country.
 *
 * STILL NOT built — checked, no free/reliable source found, or genuinely
 * out of scope for incremental work on an existing app, disclosed rather
 * than faked: province-level LGFV/property/fiscal/banking risk maps (spec
 * §30-32, 62, 65 — no free province-level breakdown exists for any of
 * these), Total Social Financing / credit-impulse computed from raw PBOC
 * flow data (spec §14-15 — BIS's own official Credit-to-GDP Gap is used as
 * the already-established free proxy, same as the flat china.ts engine),
 * individual LGFV bond/developer default event tracking (spec §8, 41 — no
 * free source tracks these in structured form), a genuine bank/property/
 * LGFV exposure-weighted contagion NETWORK graph (spec §12, 46, 84 — needs
 * bilateral exposure data no free source publishes; the Convergence score
 * above is a breadth proxy, not a network), shadow-banking/NBFI-specific
 * tracking (spec §13, distinct from this app's existing general NBFI
 * registry), the China Policy Ammunition/fiscal-monetary-FX space index
 * (spec §35 — needs central-bank-balance-sheet capacity data not
 * structured anywhere free), a 15-scenario stress-test library with a
 * user-facing policy-response simulator (spec §49-50), historical
 * backtesting with lead-time/AUC/Brier-score validation (spec §75-77), a
 * daily 8am IST report and full AI Q&A/RAG layer (spec §73-74, 81), and a
 * China-specific alert engine (spec §79-80, distinct from this app's
 * existing site-wide freshness/verification checks).
 */

export type ChinaRegimeLabel = "STABLE" | "VULNERABILITY_BUILDING" | "IMBALANCE_BUILDING" | "MARKET_STRESS" | "SYSTEMIC_CRISIS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): ChinaRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "STABLE";
  if (score < 40) return "VULNERABILITY_BUILDING";
  if (score < 60) return "IMBALANCE_BUILDING";
  if (score < 80) return "MARKET_STRESS";
  return "SYSTEMIC_CRISIS";
}

export type ChinaStageKey = "STABLE" | "VULNERABILITY_BUILDING" | "IMBALANCE" | "MARKET_WARNING" | "FUNDING_CREDIT_STRESS" | "FINANCIAL_STRESS" | "SYSTEMIC_CONTAGION";

export type ChinaStageDef = {
  stage: number; // 1-7
  key: ChinaStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const CHINA_STAGES: ChinaStageDef[] = [
  { stage: 1, key: "STABLE", label: "Stage 1 — Stable", shortLabel: "Stable", description: "Property, banking, fiscal/LGFV, deflation, external and liquidity readings all sit within normal historical ranges." },
  { stage: 2, key: "VULNERABILITY_BUILDING", label: "Stage 2 — Vulnerability Building", shortLabel: "Vulnerability Building", description: "Structural domains deteriorating while market pricing (Shanghai Composite) hasn't reacted yet — genuinely computed Hidden China Risk, not asserted." },
  { stage: 3, key: "IMBALANCE", label: "Stage 3 — Imbalance", shortLabel: "Imbalance", description: "Market pricing deteriorating well ahead of the underlying structural fundamentals (a market-led warning), or the blended score has crossed into genuine imbalance territory." },
  { stage: 4, key: "MARKET_WARNING", label: "Stage 4 — Market Warning", shortLabel: "Market Warning", description: "Blended composite score has crossed into the range this model treats as a genuine market-recognized warning." },
  { stage: 5, key: "FUNDING_CREDIT_STRESS", label: "Stage 5 — Funding / Credit Stress", shortLabel: "Funding Stress", description: "Severe, broad-based deterioration across structural and market readings together." },
  { stage: 6, key: "FINANCIAL_STRESS", label: "Stage 6 — Financial Stress", shortLabel: "Financial Stress", description: "Near the top of the observed stress range on this model's 0-100 scale." },
  { stage: 7, key: "SYSTEMIC_CONTAGION", label: "Stage 7 — Systemic Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL SIX structural domains are simultaneously elevated at once (a high Convergence reading) alongside an already-high composite — genuine cross-domain convergence, not one bad input." },
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

export function chinaStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean, convergenceScore: number | null): ChinaStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  if (convergenceScore !== null && convergenceScore >= 80 && compositeScore >= 60) stage = 7;
  else if (convergenceScore !== null && convergenceScore >= 60 && compositeScore >= 50) stage = Math.max(stage, 6);
  return CHINA_STAGES[Math.min(stage, 7) - 1];
}

export const STRUCTURAL_WEIGHTS = { property: 0.25, banking: 0.2, fiscal: 0.15, deflation: 0.15, external: 0.15, liquidity: 0.1 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, market: 0.35, convergence: 0.25 };

const PROPERTY_SALES_KEY = "china.property_sales";
const DEVELOPER_FINANCING_KEY = "china.developer_financing";
const LGFV_DEBT_KEY = "china.lgfv_debt";
const CPI_KEY = "china.cpi_index";
const FX_KEY = "fx.usdcny";
const RESERVES_KEY = "liquidity.china_reserves_ex_gold";
const EXPORTS_KEY = "china.exports_cny";
const IMPORTS_KEY = "china.imports_cny";
const INTERBANK_KEY = "china.interbank_rate_3m";
const MARKET_KEY = "equity.shanghai_composite";

const MONTHLY_WINDOW = 36;

/**
 * YoY %-change series from a monthly index/level series, date-matched (not
 * index-shifted) so a missing month doesn't silently misalign the pairing —
 * for each point, the nearest prior observation 335-396 days back (an
 * 11-13-month tolerance band) is used as the year-ago comparison.
 */
function yoyPctChangeSeries(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const out: Point[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const currentMs = new Date(sorted[i].t).getTime();
    let prior: Point | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const diffDays = (currentMs - new Date(sorted[j].t).getTime()) / 86_400_000;
      if (diffDays > 396) break;
      if (diffDays >= 335) {
        prior = sorted[j];
        break;
      }
    }
    if (prior && prior.v !== 0) out.push({ t: sorted[i].t, v: ((sorted[i].v - prior.v) / Math.abs(prior.v)) * 100 });
  }
  return out;
}

/** Fixed, disclosed calibration for the IMF Augmented Debt (% of GDP)
 * annual series — see file-level comment for why this domain cannot be
 * own-history z-scored (only ~6 annual points exist). 60% of GDP -> 0 risk,
 * 160% -> 100 risk, linear, clamped. */
function augmentedDebtScore(pctGdp: number): number {
  return Math.round(clamp(((pctGdp - 60) / (160 - 60)) * 100, 0, 100));
}

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

export type ChinaIndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

export type ChinaSystemicRiskResult = {
  propertyReading: { salesValue: number | null; salesAsOf: string | null; financingValue: number | null; financingAsOf: string | null };
  propertyExternalScore: number | null;
  propertyActivityScore: number | null;
  propertyScore: number | null;
  bankingScore: number | null;
  fiscalReading: ChinaIndicatorReading;
  fiscalScore: number | null;
  deflationReading: ChinaIndicatorReading;
  deflationScore: number | null;
  externalFxReading: { cny: ChinaIndicatorReading; reserves: ChinaIndicatorReading; tradeBalance: ChinaIndicatorReading };
  externalScore: number | null;
  liquidityReading: ChinaIndicatorReading;
  liquidityScore: number | null;
  marketReading: ChinaIndicatorReading;
  marketScore: number | null;
  structuralScore: number | null;
  convergenceScore: number | null;
  compositeScore: number | null;
  regime: ChinaRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
};

export async function getChinaSystemicRiskResult(db: SupabaseClient): Promise<ChinaSystemicRiskResult> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceMonthly = new Date();
  sinceMonthly.setUTCDate(sinceMonthly.getUTCDate() - lookbackDaysFor("monthly"));
  const sinceAnnual = new Date();
  sinceAnnual.setUTCDate(sinceAnnual.getUTCDate() - lookbackDaysFor("annual"));

  const [
    salesSeries,
    financingSeries,
    lgfvSeries,
    cpiSeries,
    fxSeries,
    reservesSeries,
    exportsSeries,
    importsSeries,
    interbankSeries,
    marketSeries,
    bankingRows,
    propertyRows,
  ] = await Promise.all([
    fetchSeries(db, PROPERTY_SALES_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, DEVELOPER_FINANCING_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, LGFV_DEBT_KEY, sinceAnnual.toISOString()),
    fetchSeries(db, CPI_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, FX_KEY, sinceDaily.toISOString()),
    fetchSeries(db, RESERVES_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, EXPORTS_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, IMPORTS_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, INTERBANK_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, MARKET_KEY, sinceDaily.toISOString()),
    getBankingSystemicRiskTable(db),
    getPropertySystemicRiskTable(db),
  ]);

  // Property domain
  const salesScore = zToRiskScore(zScore(salesSeries, MONTHLY_WINDOW), -1);
  const financingScore = zToRiskScore(zScore(financingSeries, MONTHLY_WINDOW), -1);
  const activityParts = [salesScore, financingScore].filter((v): v is number => v !== null);
  const propertyActivityScore = activityParts.length > 0 ? Math.round(activityParts.reduce((a, b) => a + b, 0) / activityParts.length) : null;
  const chinaPropertyRow = propertyRows.find((r) => r.countryKey === "china") ?? null;
  const propertyExternalScore = chinaPropertyRow?.compositeScore ?? null;
  const propertyParts = [propertyExternalScore, propertyActivityScore].filter((v): v is number => v !== null);
  const propertyScore = propertyParts.length > 0 ? Math.round(propertyParts.reduce((a, b) => a + b, 0) / propertyParts.length) : null;

  // Banking domain (read, not recomputed)
  const chinaBankingRow = bankingRows.find((r) => r.country === "China") ?? null;
  const bankingScore = chinaBankingRow?.compositeScore ?? null;

  // Fiscal / LGFV domain
  const lgfvLast = latestPoint(lgfvSeries);
  const fiscalScore = lgfvLast !== null ? augmentedDebtScore(lgfvLast.v) : null;

  // Deflation domain
  const cpiYoySeries = yoyPctChangeSeries(cpiSeries);
  const deflationScore = zToRiskScore(zScore(cpiYoySeries, MONTHLY_WINDOW), -1);
  const cpiYoyLast = latestPoint(cpiYoySeries);

  // External / FX domain
  const cnyScore = zToRiskScore(zScore(fxSeries, 252), 1);
  const reservesScore = zToRiskScore(zScore(reservesSeries, MONTHLY_WINDOW), -1);
  const tradeBalanceSeries = subtractSeriesByDate(exportsSeries, importsSeries);
  const tradeBalanceScore = zToRiskScore(zScore(tradeBalanceSeries, MONTHLY_WINDOW), -1);
  const externalParts = [
    cnyScore !== null ? { score: cnyScore, weight: 0.4 } : null,
    reservesScore !== null ? { score: reservesScore, weight: 0.3 } : null,
    tradeBalanceScore !== null ? { score: tradeBalanceScore, weight: 0.3 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const externalScore = externalParts.length > 0 ? Math.round(externalParts.reduce((a, b) => a + b.score * b.weight, 0) / externalParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Liquidity / money-market domain
  const liquidityScore = zToRiskScore(zScore(interbankSeries, MONTHLY_WINDOW), 1);

  // Structural composite
  const structuralParts = [
    propertyScore !== null ? { score: propertyScore, weight: STRUCTURAL_WEIGHTS.property } : null,
    bankingScore !== null ? { score: bankingScore, weight: STRUCTURAL_WEIGHTS.banking } : null,
    fiscalScore !== null ? { score: fiscalScore, weight: STRUCTURAL_WEIGHTS.fiscal } : null,
    deflationScore !== null ? { score: deflationScore, weight: STRUCTURAL_WEIGHTS.deflation } : null,
    externalScore !== null ? { score: externalScore, weight: STRUCTURAL_WEIGHTS.external } : null,
    liquidityScore !== null ? { score: liquidityScore, weight: STRUCTURAL_WEIGHTS.liquidity } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const structuralScore = structuralParts.length > 0 ? Math.round(structuralParts.reduce((a, b) => a + b.score * b.weight, 0) / structuralParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Market domain
  const priceScore = zToRiskScore(zScore(marketSeries, 252), -1);
  const volScore = zToRiskScore(zScore(rollingRealizedVolSeries(marketSeries), 252), 1);
  const marketParts = [
    priceScore !== null ? { score: priceScore, weight: 0.6 } : null,
    volScore !== null ? { score: volScore, weight: 0.4 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const marketScore = marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b.score * b.weight, 0) / marketParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Convergence: fraction of the six structural domains independently >=60
  const domainScores = [propertyScore, bankingScore, fiscalScore, deflationScore, externalScore, liquidityScore];
  const domainsWithData = domainScores.filter((v) => v !== null) as number[];
  const domainsStressed = domainsWithData.filter((v) => v >= 60).length;
  const convergenceScore = domainsWithData.length >= 4 ? Math.round((domainsStressed / domainsWithData.length) * 100) : null;

  const compositeParts = [
    structuralScore !== null ? { score: structuralScore, weight: COMPOSITE_WEIGHTS.structural } : null,
    marketScore !== null ? { score: marketScore, weight: COMPOSITE_WEIGHTS.market } : null,
    convergenceScore !== null ? { score: convergenceScore, weight: COMPOSITE_WEIGHTS.convergence } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const compositeScore = compositeParts.length > 0 ? Math.round(compositeParts.reduce((a, b) => a + b.score * b.weight, 0) / compositeParts.reduce((a, b) => a + b.weight, 0)) : null;

  const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
  const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
  const stageDef = chinaStageFor(compositeScore, hiddenRisk, marketLedWarning, convergenceScore);

  const salesLast = latestPoint(salesSeries);
  const financingLast = latestPoint(financingSeries);
  const fxLast = latestPoint(fxSeries);
  const reservesLast = latestPoint(reservesSeries);
  const tradeBalanceLast = latestPoint(tradeBalanceSeries);
  const interbankLast = latestPoint(interbankSeries);
  const marketLast = latestPoint(marketSeries);

  const applicableScores = [propertyScore, bankingScore, fiscalScore, deflationScore, externalScore, liquidityScore, marketScore];
  const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
  const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

  return {
    propertyReading: { salesValue: salesLast?.v ?? null, salesAsOf: salesLast?.t ?? null, financingValue: financingLast?.v ?? null, financingAsOf: financingLast?.t ?? null },
    propertyExternalScore,
    propertyActivityScore,
    propertyScore,
    bankingScore,
    fiscalReading: { value: lgfvLast?.v ?? null, asOf: lgfvLast?.t ?? null, score: fiscalScore, previousValue: previousOf(lgfvSeries)?.v ?? null },
    fiscalScore,
    deflationReading: { value: cpiYoyLast?.v ?? null, asOf: cpiYoyLast?.t ?? null, score: deflationScore, previousValue: previousOf(cpiYoySeries)?.v ?? null },
    deflationScore,
    externalFxReading: {
      cny: { value: fxLast?.v ?? null, asOf: fxLast?.t ?? null, score: cnyScore, previousValue: previousOf(fxSeries)?.v ?? null },
      reserves: { value: reservesLast?.v ?? null, asOf: reservesLast?.t ?? null, score: reservesScore, previousValue: previousOf(reservesSeries)?.v ?? null },
      tradeBalance: { value: tradeBalanceLast?.v ?? null, asOf: tradeBalanceLast?.t ?? null, score: tradeBalanceScore, previousValue: previousOf(tradeBalanceSeries)?.v ?? null },
    },
    externalScore,
    liquidityReading: { value: interbankLast?.v ?? null, asOf: interbankLast?.t ?? null, score: liquidityScore, previousValue: previousOf(interbankSeries)?.v ?? null },
    liquidityScore,
    marketReading: { value: marketLast?.v ?? null, asOf: marketLast?.t ?? null, score: marketScore, previousValue: previousOf(marketSeries)?.v ?? null },
    marketScore,
    structuralScore,
    convergenceScore,
    compositeScore,
    regime: labelFromScore(compositeScore),
    hiddenRisk,
    marketLedWarning,
    dataCompleteness,
    stage: stageDef?.stage ?? null,
    stageLabel: stageDef?.shortLabel ?? "—",
  };
}

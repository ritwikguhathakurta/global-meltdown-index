import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries, fetchLatestForKeys } from "../metrics/store";
import { zScore, zToRiskScore, diffSeriesByMonth, previousOf, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { G7_COUNTRIES } from "../sources/g7Fiscal";

/**
 * G7 Sovereign Debt — per-country structural + market + funding/contagion
 * model, built against a 106-section institutional spec ("G7 Sovereign Debt
 * Systemic Risk Engine": debt dynamics, refinancing, auction stress, term
 * premium, central-bank balance-sheet dependency, bank/NBFI nexus, a PCA
 * factor model, an interactive contagion network, historical backtesting to
 * 1992, a daily AI report, 10 stress scenarios...). Checked component by
 * component against what free, verified data actually supports for all
 * seven countries at once, the same discipline applied to the EM Debt engine
 * — what's built here is the genuinely free-data-backed subset; everything
 * else is disclosed as deferred rather than faked. See the methodology page
 * for the full breakdown of what didn't make it in and why.
 *
 * This deliberately does NOT register as a second GFMI-weighted engine. The
 * existing "us_treasury_sovereign" engine (treasury.ts) already covers
 * exactly this same seven-country universe with 10Y/30Y yields and
 * debt/GDP, and the engine registry's own design (see registry.ts) folded
 * "Global Sovereign Debt" into that engine specifically to avoid double-
 * counting the same underlying sovereign-yield/debt signal twice in the
 * composite — the spec's own section 97 explicitly warns against exactly
 * this. This module instead reuses that engine's existing yield and
 * debt/GDP series as inputs to a deeper three-score-per-country breakdown
 * (Structural Vulnerability / Market Stress / Funding-Contagion, per spec
 * §5) plus a 7-stage crisis model, exposed on its own dashboard page —
 * genuinely new analysis, not a second vote in GFMI.
 *
 * STRUCTURAL VULNERABILITY (cross-sectionally z-scored against the other six
 * G7 economies at each observation, same "peer group, not universal
 * threshold" principle as EM Debt):
 *  - Government debt/GDP — six of seven read the SAME FRED-sourced series
 *    already powering the Treasury engine (sovereign.*_debt_to_gdp); France
 *    has no such series anywhere in this project (checked directly — FRED
 *    carries no French general-government-debt/GDP series at all), so
 *    France's debt/GDP comes from IMF's Global Debt Database instead (see
 *    g7Fiscal.ts) — a genuine, disclosed gap-fill, not a substitution for a
 *    working series.
 *  - Fiscal balance/GDP — new for all seven, from IMF's World Economic
 *    Outlook database (see g7Fiscal.ts), since no existing source in this
 *    project tracked this for any G7 country.
 *  - Real GDP growth and current account/GDP — both new for all seven, from
 *    World Bank Open Data (see g7Fiscal.ts), the same two indicators (and
 *    same weights) already used in EM Debt's own structural score — growth
 *    affects debt-dynamics sustainability via r-g, current-account deficits
 *    signal external financing need.
 * NOT included, checked and explicitly deferred: interest-burden/GFR/
 * maturity-wall/auction-stress/investor-base (spec §17-25, 32, 51-53) — no
 * single free, uniformly-available-for-all-seven source for per-country
 * government interest expense, auction results or investor ownership was
 * verified live this session (US Treasury Fiscal Data and Japan's MOF both
 * publish auction results, but Germany/France/Italy/UK/Canada do not have an
 * equally open, uniformly-parseable equivalent within reasonable effort —
 * building seven different national auction parsers is a real, large effort
 * not attempted this pass).
 *
 * MARKET STRESS:
 *  - The same 10Y yield series the Treasury engine already tracks per
 *    country (Bundesbank/BoE/BoC/MOF daily; FRED/OECD monthly proxy for
 *    Italy and France — see govBondYields.ts and treasury.ts for exactly
 *    why those two remain on the slower proxy), own-history time-series
 *    z-score.
 *  - For France and Italy specifically, additionally blended with the
 *    France-Bund and Italy-Bund 10Y spread's own time-series z-score (the
 *    standard eurozone-fragmentation gauge, spec §11-13/39/42) — Germany has
 *    no "vs-Bund" spread since it IS the Bund.
 *  - Sovereign CDS (Damodaran/NYU Stern annual snapshot, same source and
 *    caveats as EM Debt — see g7Fiscal.ts), cross-sectionally z-scored
 *    against the other six G7 economies since it's a single annual point
 *    per country, not a time series.
 *  - Currency vs USD (ECB/Frankfurter daily reference rate — see fx.ts),
 *    own-history time-series z-score, for the six non-US countries (the
 *    dollar is the numeraire here, so the US has no own-currency pair).
 *    Reserve-currency FX moves are a much weaker stress signal than for an
 *    EM currency, but a genuine, live, free one — the same "blend of
 *    whatever's available" approach used everywhere else in this engine.
 *
 * FUNDING/CONTAGION — a single G7-wide breadth reading (the fraction of the
 * OTHER six G7 economies whose preliminary structural+market blend is
 * already elevated, >= 60), applied identically to all seven countries this
 * pass — a real, computed signal (same "breadth" concept as EM Debt's
 * contagion measure), but disclosed as a simplification: it is not yet a
 * bespoke bilateral-exposure-weighted contagion score (spec §65's bond-
 * correlation/yield-beta/financial-sector-exposure network), since no free
 * source gives that cross-holdings data for free. Auction-level and bank/
 * NBFI-nexus funding-stress components (spec §33-37, 58) are likewise not
 * included — checked, no free per-country source, disclosed rather than
 * faked.
 *
 * Composite blend per country: 40% structural + 35% market + 25% funding,
 * the spec's own base weighting (§5), using whichever parts are available
 * (never fabricating a missing one). The G7-wide composite score (shown on
 * the dashboard page next to the existing Treasury engine's own score) is a
 * GDP-weighted average of the seven countries' vulnerability scores — not a
 * flat seven-way average — per spec §59's explicit requirement that the US
 * and Japan carry more global-transmission weight than smaller G7 economies;
 * GDP share (World Bank, see g7Fiscal.ts) is used as the free, defensible
 * size weight.
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked: PCA/
 * factor-model risk decomposition (§70), an interactive sovereign-contagion
 * network graph (§96), historical backtesting against 1992-2024 crisis
 * episodes with lead-time analysis (§91-93), a daily 8am G7 debt report and
 * AI Q&A layer (§86-89), the full 10-scenario stress-test library and 5-year
 * debt-path projections (§71-74), and per-country auction/investor-base/
 * central-bank-holdings dependency tracking (§30-38).
 */

export type G7DebtRegimeLabel = "WELL_ABSORBED" | "NORMAL" | "SOFTENING_DEMAND" | "FUNDING_STRESS" | "DISLOCATED" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): G7DebtRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "WELL_ABSORBED";
  if (score < 40) return "NORMAL";
  if (score < 60) return "SOFTENING_DEMAND";
  if (score < 80) return "FUNDING_STRESS";
  return "DISLOCATED";
}

/**
 * 7-stage crisis progression, adapted from the spec's own "STAGE 0 — STABLE"
 * through "STAGE 6 — SYSTEMIC CONTAGION" (§63), renumbered 1-7 to match the
 * same convention already used for EM Debt (emDebtRegime.ts) and the GFMI
 * composite (gfmi.ts) rather than introducing a third, zero-based numbering
 * scheme into the same app. Same 15/30/45/60/75/90 score bands used
 * everywhere else. Stage 2 (Vulnerability Building) and Stage 3 (Market
 * Repricing) are promoted (never demoted) by the hiddenRisk/marketLed flags
 * this module already computes for real — the spec's own stage names happen
 * to match those two flags almost exactly.
 */
export type G7CrisisStageKey =
  | "STABLE"
  | "VULNERABILITY_BUILDING"
  | "MARKET_REPRICING"
  | "FUNDING_PRESSURE"
  | "SELF_REINFORCING_LOOP"
  | "SOVEREIGN_CRISIS"
  | "SYSTEMIC_CONTAGION";

export type G7CrisisStageDef = {
  stage: number; // 1-7
  key: G7CrisisStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const G7_CRISIS_STAGES: G7CrisisStageDef[] = [
  { stage: 1, key: "STABLE", label: "Stage 1 — Stable", shortLabel: "Stable", description: "Debt fundamentals and bond-market pricing are both calm." },
  { stage: 2, key: "VULNERABILITY_BUILDING", label: "Stage 2 — Vulnerability Building", shortLabel: "Vulnerability Building", description: "Structural fundamentals (debt/GDP, fiscal balance) deteriorating while bond-market pricing hasn't reacted yet — genuinely computed, not asserted." },
  { stage: 3, key: "MARKET_REPRICING", label: "Stage 3 — Market Repricing", shortLabel: "Market Repricing", description: "Bond yields (and, for France/Italy, the spread to Bunds) moving materially ahead of the underlying fiscal fundamentals." },
  { stage: 4, key: "FUNDING_PRESSURE", label: "Stage 4 — Funding Pressure", shortLabel: "Funding Pressure", description: "Blended score has crossed into the range this model treats as genuine funding-condition tightening." },
  { stage: 5, key: "SELF_REINFORCING_LOOP", label: "Stage 5 — Self-Reinforcing Fiscal-Market Loop", shortLabel: "Self-Reinforcing Loop", description: "Severe, broad-based deterioration across structural and market readings together." },
  { stage: 6, key: "SOVEREIGN_CRISIS", label: "Stage 6 — Sovereign Crisis", shortLabel: "Sovereign Crisis", description: "Near the top of the observed stress range on this model's 0-100 scale." },
  { stage: 7, key: "SYSTEMIC_CONTAGION", label: "Stage 7 — Systemic Contagion", shortLabel: "Systemic Contagion", description: "The top of what this model can measure. This is a score band, not a confirmed sovereign-debt crisis — no free data source observes an actual default or IMF program, so treat this as 'as severe as this model can measure,' not as proof of one." },
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

export function g7CrisisStageFor(vulnerabilityScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean): G7CrisisStageDef | null {
  if (vulnerabilityScore === null) return null;
  let stage = stageNumberFromScore(vulnerabilityScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  return G7_CRISIS_STAGES[stage - 1];
}

const DEBT_KEY: Record<string, string> = {
  us: "sovereign.us_debt_to_gdp",
  germany: "sovereign.germany_debt_to_gdp",
  italy: "sovereign.italy_debt_to_gdp",
  japan: "sovereign.japan_debt_to_gdp",
  canada: "sovereign.canada_debt_to_gdp",
  uk: "sovereign.uk_debt_to_gdp",
  france: "g7.france.govt_debt_to_gdp",
};

const YIELD_KEY: Record<string, string> = {
  us: "yield.us10y",
  uk: "yield.uk_10y",
  germany: "yield.germany_10y",
  france: "yield.france_10y",
  italy: "yield.italy_10y",
  japan: "yield.japan_10y",
  canada: "yield.canada_10y",
};

const YIELD_FREQ: Record<string, "daily" | "monthly"> = {
  us: "daily", uk: "daily", germany: "daily", japan: "daily", canada: "daily",
  france: "monthly", italy: "monthly",
};

/** Currency vs USD — no entry for "us" since the dollar is the numeraire. */
const FX_KEY: Record<string, string> = {
  japan: "fx.usdjpy",
  germany: "fx.usdeur",
  france: "fx.usdeur",
  italy: "fx.usdeur",
  uk: "fx.usdgbp",
  canada: "fx.usdcad",
};

const FX_PAIR_LABEL: Record<string, string> = {
  japan: "USD/JPY", germany: "USD/EUR", france: "USD/EUR", italy: "USD/EUR", uk: "USD/GBP", canada: "USD/CAD",
};

export type G7IndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

/**
 * US-only live detail (debt-to-the-penny composition, Fed SOMA Treasury
 * holdings, 10Y/30Y auction results — see usTreasuryDebt.ts). Deliberately
 * NOT folded into structuralScore/marketScore above: it exists for only one
 * of the seven countries, so blending it in would silently give the US a
 * different-shaped score than its six peers, and the auction bid-to-cover
 * series needs ~20 real auctions of history (roughly 20 months, since each
 * tenor is auctioned monthly) before zScore() can even compute a baseline —
 * shown here as genuine live context that will start contributing a
 * proper time-series signal as that history accumulates, not faked in the
 * meantime.
 */
export type UsTreasuryDetail = {
  debtHeldByPublicUsd: number | null;
  debtIntragovernmentalUsd: number | null;
  debtTotalUsd: number | null;
  debtTotalPreviousUsd: number | null;
  debtAsOf: string | null;
  fedTreasuryHoldingsUsd: number | null;
  fedTreasuryHoldingsPreviousUsd: number | null;
  fedHoldingsSharePct: number | null;
  fedHoldingsAsOf: string | null;
  auction10yBidToCover: number | null;
  auction10yBidToCoverPrevious: number | null;
  auction10yIndirectPct: number | null;
  auction10yHighYield: number | null;
  auction10yAsOf: string | null;
  auction30yBidToCover: number | null;
  auction30yBidToCoverPrevious: number | null;
  auction30yIndirectPct: number | null;
  auction30yHighYield: number | null;
  auction30yAsOf: string | null;
};

export type CountryG7DebtRow = {
  country: string;
  currency: string;
  centralBank: string;
  debtToGdp: G7IndicatorReading;
  fiscalBalanceToGdp: G7IndicatorReading;
  realGdpGrowth: G7IndicatorReading;
  currentAccountToGdp: G7IndicatorReading;
  yield10y: G7IndicatorReading;
  bundSpreadBps: G7IndicatorReading | null;
  sovereignCds: G7IndicatorReading;
  /** Null only for the US — the dollar is the numeraire, so it has no own-currency pair. */
  fx: { pair: string; value: number | null; asOf: string | null; score: number | null; previousValue: number | null } | null;
  structuralScore: number | null;
  marketScore: number | null;
  fundingScore: number | null;
  vulnerabilityScore: number | null;
  regime: G7DebtRegimeLabel;
  /** Structural vulnerability elevated while bond-market pricing is still calm. */
  hiddenRisk: boolean;
  /** Bond-market pricing deteriorating faster than structural fundamentals. */
  marketLedWarning: boolean;
  dataCompleteness: number;
  crisisStage: number | null;
  crisisStageLabel: string;
  /** Only populated for the US row — see UsTreasuryDetail. */
  usDetail: UsTreasuryDetail | null;
};

/** Cross-sectional z-score across G7 peers — mirrors emDebtRegime.ts's own
 * helper; kept as a separate copy rather than a shared import since each
 * engine's peer set and minimum-sample threshold are conceptually distinct. */
function crossSectionalZ(values: Map<string, number>): Map<string, number> {
  const z = new Map<string, number>();
  const arr = Array.from(values.values());
  if (arr.length < 4) return z;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const sd = Math.sqrt(variance);
  for (const [k, v] of values) z.set(k, sd > 0 ? (v - mean) / sd : 0);
  return z;
}

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

export async function getCountryG7DebtTable(db: SupabaseClient): Promise<CountryG7DebtRow[]> {
  const yieldSeriesByCountry = new Map(
    await Promise.all(
      G7_COUNTRIES.map(async (c) => {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - lookbackDaysFor(YIELD_FREQ[c.key]));
        return [c.key, await fetchSeries(db, YIELD_KEY[c.key], since.toISOString())] as const;
      })
    )
  );

  const germanySeries = yieldSeriesByCountry.get("germany") ?? [];
  const franceSpread = diffSeriesByMonth(yieldSeriesByCountry.get("france") ?? [], germanySeries);
  const italySpread = diffSeriesByMonth(yieldSeriesByCountry.get("italy") ?? [], germanySeries);
  const spreadByCountry: Record<string, Point[]> = { france: franceSpread, italy: italySpread };

  const fxSeriesByCountry = new Map(
    await Promise.all(
      G7_COUNTRIES.filter((c) => FX_KEY[c.key]).map(async (c) => {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
        return [c.key, await fetchSeries(db, FX_KEY[c.key], since.toISOString())] as const;
      })
    )
  );

  const US_DETAIL_KEYS = [
    "g7.us.debt_held_by_public_usd",
    "g7.us.debt_intragovernmental_usd",
    "g7.us.debt_total_usd",
    "g7.us.fed_treasury_holdings_usd",
    "g7.us.auction_10y_bid_to_cover",
    "g7.us.auction_10y_indirect_pct",
    "g7.us.auction_10y_high_yield",
    "g7.us.auction_30y_bid_to_cover",
    "g7.us.auction_30y_indirect_pct",
    "g7.us.auction_30y_high_yield",
  ];
  const latestKeys = [
    ...G7_COUNTRIES.map((c) => DEBT_KEY[c.key]),
    ...G7_COUNTRIES.map((c) => `g7.${c.key}.fiscal_balance_to_gdp`),
    ...G7_COUNTRIES.map((c) => `g7.${c.key}.gdp_current_usd`),
    ...G7_COUNTRIES.map((c) => `g7.${c.key}.real_gdp_growth`),
    ...G7_COUNTRIES.map((c) => `g7.${c.key}.current_account_to_gdp`),
    ...G7_COUNTRIES.map((c) => `g7.${c.key}.sovereign_cds_10y`),
    ...US_DETAIL_KEYS,
  ];
  const latest = await fetchLatestForKeys(db, latestKeys);

  const usDetail: UsTreasuryDetail | null = (() => {
    const debtTotal = latest.get("g7.us.debt_total_usd");
    const fedHoldings = latest.get("g7.us.fed_treasury_holdings_usd");
    const fedSharePct = debtTotal && fedHoldings && debtTotal.v > 0 ? (fedHoldings.v / debtTotal.v) * 100 : null;
    return {
      debtHeldByPublicUsd: latest.get("g7.us.debt_held_by_public_usd")?.v ?? null,
      debtIntragovernmentalUsd: latest.get("g7.us.debt_intragovernmental_usd")?.v ?? null,
      debtTotalUsd: debtTotal?.v ?? null,
      debtTotalPreviousUsd: debtTotal?.previous?.v ?? null,
      debtAsOf: debtTotal?.t ?? null,
      fedTreasuryHoldingsUsd: fedHoldings?.v ?? null,
      fedTreasuryHoldingsPreviousUsd: fedHoldings?.previous?.v ?? null,
      fedHoldingsSharePct: fedSharePct,
      fedHoldingsAsOf: fedHoldings?.t ?? null,
      auction10yBidToCover: latest.get("g7.us.auction_10y_bid_to_cover")?.v ?? null,
      auction10yBidToCoverPrevious: latest.get("g7.us.auction_10y_bid_to_cover")?.previous?.v ?? null,
      auction10yIndirectPct: latest.get("g7.us.auction_10y_indirect_pct")?.v ?? null,
      auction10yHighYield: latest.get("g7.us.auction_10y_high_yield")?.v ?? null,
      auction10yAsOf: latest.get("g7.us.auction_10y_bid_to_cover")?.t ?? null,
      auction30yBidToCover: latest.get("g7.us.auction_30y_bid_to_cover")?.v ?? null,
      auction30yBidToCoverPrevious: latest.get("g7.us.auction_30y_bid_to_cover")?.previous?.v ?? null,
      auction30yIndirectPct: latest.get("g7.us.auction_30y_indirect_pct")?.v ?? null,
      auction30yHighYield: latest.get("g7.us.auction_30y_high_yield")?.v ?? null,
      auction30yAsOf: latest.get("g7.us.auction_30y_bid_to_cover")?.t ?? null,
    };
  })();

  const debtValues = new Map<string, number>();
  const fiscalValues = new Map<string, number>();
  const gdpGrowthValues = new Map<string, number>();
  const currentAccountValues = new Map<string, number>();
  const cdsValues = new Map<string, number>();
  for (const c of G7_COUNTRIES) {
    const d = latest.get(DEBT_KEY[c.key]);
    if (d) debtValues.set(c.key, d.v);
    const f = latest.get(`g7.${c.key}.fiscal_balance_to_gdp`);
    if (f) fiscalValues.set(c.key, f.v);
    const g = latest.get(`g7.${c.key}.real_gdp_growth`);
    if (g) gdpGrowthValues.set(c.key, g.v);
    const ca = latest.get(`g7.${c.key}.current_account_to_gdp`);
    if (ca) currentAccountValues.set(c.key, ca.v);
    const cds = latest.get(`g7.${c.key}.sovereign_cds_10y`);
    if (cds) cdsValues.set(c.key, cds.v);
  }
  const debtZ = crossSectionalZ(debtValues);
  const fiscalZ = crossSectionalZ(fiscalValues);
  const gdpGrowthZ = crossSectionalZ(gdpGrowthValues);
  const currentAccountZ = crossSectionalZ(currentAccountValues);
  const cdsZ = crossSectionalZ(cdsValues);

  // Pass 1: structural + market scores per country (funding/contagion needs
  // these first, since it's a breadth measure over the whole G7 set).
  const prelim = G7_COUNTRIES.map((c) => {
    const debtScore = debtZ.has(c.key) ? zToRiskScore(debtZ.get(c.key) ?? null, 1) : null;
    const fiscalScore = fiscalZ.has(c.key) ? zToRiskScore(fiscalZ.get(c.key) ?? null, -1) : null;
    const gdpGrowthScore = gdpGrowthZ.has(c.key) ? zToRiskScore(gdpGrowthZ.get(c.key) ?? null, -1) : null;
    const currentAccountScore = currentAccountZ.has(c.key) ? zToRiskScore(currentAccountZ.get(c.key) ?? null, -1) : null;
    const structParts = [
      debtScore !== null ? { score: debtScore, weight: 1.0 } : null,
      fiscalScore !== null ? { score: fiscalScore, weight: 0.9 } : null,
      gdpGrowthScore !== null ? { score: gdpGrowthScore, weight: 0.6 } : null,
      currentAccountScore !== null ? { score: currentAccountScore, weight: 0.8 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const structuralScore =
      structParts.length > 0
        ? Math.round(structParts.reduce((a, b) => a + b.score * b.weight, 0) / structParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const yieldSeries = yieldSeriesByCountry.get(c.key) ?? [];
    const yieldWindow = YIELD_FREQ[c.key] === "daily" ? 252 : 36;
    const yieldScore = zToRiskScore(zScore(yieldSeries, yieldWindow), 1);
    const spreadSeries = spreadByCountry[c.key];
    const spreadScore = spreadSeries ? zToRiskScore(zScore(spreadSeries, 36), 1) : null;
    const cdsScore = cdsZ.has(c.key) ? zToRiskScore(cdsZ.get(c.key) ?? null, 1) : null;
    const fxSeries = fxSeriesByCountry.get(c.key);
    const fxScore = fxSeries ? zToRiskScore(zScore(fxSeries, 252), 1) : null;
    const marketParts = [yieldScore, spreadScore, cdsScore, fxScore].filter((s): s is number => s !== null);
    const marketScore = marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b, 0) / marketParts.length) : null;

    const prelimParts = [
      structuralScore !== null ? { score: structuralScore, weight: 0.4 } : null,
      marketScore !== null ? { score: marketScore, weight: 0.35 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const prelimScore =
      prelimParts.length > 0
        ? prelimParts.reduce((a, b) => a + b.score * b.weight, 0) / prelimParts.reduce((a, b) => a + b.weight, 0)
        : null;

    return {
      c, debtScore, fiscalScore, gdpGrowthScore, currentAccountScore, structuralScore,
      yieldScore, spreadScore, cdsScore, fxScore, marketScore, prelimScore,
    };
  });

  return prelim.map(({ c, debtScore, fiscalScore, gdpGrowthScore, currentAccountScore, structuralScore, yieldScore, spreadScore, cdsScore, fxScore, marketScore }) => {
    // Funding/contagion: breadth among the OTHER six — excludes this country
    // from its own denominator/numerator so a country isn't partly "warning
    // about itself".
    const others = prelim.filter((p) => p.c.key !== c.key);
    const othersWithData = others.filter((p) => p.prelimScore !== null).length;
    const othersStressed = others.filter((p) => p.prelimScore !== null && (p.prelimScore as number) >= 60).length;
    const fundingScore = othersWithData >= 4 ? Math.round((othersStressed / othersWithData) * 100) : null;

    const vulnParts = [
      structuralScore !== null ? { score: structuralScore, weight: 0.4 } : null,
      marketScore !== null ? { score: marketScore, weight: 0.35 } : null,
      fundingScore !== null ? { score: fundingScore, weight: 0.25 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const vulnerabilityScore =
      vulnParts.length > 0
        ? Math.round(vulnParts.reduce((a, b) => a + b.score * b.weight, 0) / vulnParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const debtRow = latest.get(DEBT_KEY[c.key]);
    const fiscalRow = latest.get(`g7.${c.key}.fiscal_balance_to_gdp`);
    const gdpGrowthRow = latest.get(`g7.${c.key}.real_gdp_growth`);
    const currentAccountRow = latest.get(`g7.${c.key}.current_account_to_gdp`);
    const cdsRow = latest.get(`g7.${c.key}.sovereign_cds_10y`);
    const yieldSeries = yieldSeriesByCountry.get(c.key) ?? [];
    const yieldLast = latestPoint(yieldSeries);
    const spreadSeries = spreadByCountry[c.key];
    const spreadLast = spreadSeries ? latestPoint(spreadSeries) : null;
    const fxSeries = fxSeriesByCountry.get(c.key);
    const fxLast = fxSeries ? latestPoint(fxSeries) : null;

    // Applicable indicators vary per country: bundSpread only exists for
    // France/Italy, fx only for the six non-US countries — so the
    // denominator is per-country, not a fixed constant, or a country
    // lacking an inapplicable indicator would be unfairly marked incomplete.
    const applicableScores = [
      debtScore, fiscalScore, gdpGrowthScore, currentAccountScore, yieldScore, cdsScore,
      ...(spreadSeries ? [spreadScore] : []),
      ...(fxSeries ? [fxScore] : []),
    ];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = g7CrisisStageFor(vulnerabilityScore, hiddenRisk, marketLedWarning);

    return {
      country: c.name,
      currency: c.currency,
      centralBank: c.centralBank,
      debtToGdp: { value: debtRow?.v ?? null, asOf: debtRow?.t ?? null, score: debtScore, previousValue: debtRow?.previous?.v ?? null },
      fiscalBalanceToGdp: { value: fiscalRow?.v ?? null, asOf: fiscalRow?.t ?? null, score: fiscalScore, previousValue: fiscalRow?.previous?.v ?? null },
      realGdpGrowth: { value: gdpGrowthRow?.v ?? null, asOf: gdpGrowthRow?.t ?? null, score: gdpGrowthScore, previousValue: gdpGrowthRow?.previous?.v ?? null },
      currentAccountToGdp: { value: currentAccountRow?.v ?? null, asOf: currentAccountRow?.t ?? null, score: currentAccountScore, previousValue: currentAccountRow?.previous?.v ?? null },
      yield10y: { value: yieldLast?.v ?? null, asOf: yieldLast?.t ?? null, score: yieldScore, previousValue: previousOf(yieldSeries)?.v ?? null },
      bundSpreadBps: spreadSeries ? { value: spreadLast?.v ?? null, asOf: spreadLast?.t ?? null, score: spreadScore, previousValue: previousOf(spreadSeries)?.v ?? null } : null,
      sovereignCds: { value: cdsRow?.v ?? null, asOf: cdsRow?.t ?? null, score: cdsScore, previousValue: cdsRow?.previous?.v ?? null },
      fx: FX_PAIR_LABEL[c.key] ? { pair: FX_PAIR_LABEL[c.key], value: fxLast?.v ?? null, asOf: fxLast?.t ?? null, score: fxScore, previousValue: previousOf(fxSeries ?? [])?.v ?? null } : null,
      structuralScore,
      marketScore,
      fundingScore,
      vulnerabilityScore,
      regime: labelFromScore(vulnerabilityScore),
      hiddenRisk,
      marketLedWarning,
      dataCompleteness,
      crisisStage: stageDef?.stage ?? null,
      crisisStageLabel: stageDef?.shortLabel ?? "—",
      usDetail: c.key === "us" ? usDetail : null,
    };
  });
}

export function g7Breadth(rows: CountryG7DebtRow[]): { stressedCount: number; totalWithData: number } {
  const stressedCount = rows.filter((r) => (r.vulnerabilityScore ?? 0) >= 60).length;
  const totalWithData = rows.filter((r) => r.vulnerabilityScore !== null).length;
  return { stressedCount, totalWithData };
}

/** GDP-weighted composite across the seven countries (spec §59: "must NOT
 * simply average seven countries" — the US and Japan carry more weight,
 * using GDP share as the free, defensible size proxy). Takes the already-
 * computed per-country rows rather than re-running getCountryG7DebtTable,
 * so callers that need both the table and the composite only pay for one
 * pass of the underlying fetches. */
export async function getG7CompositeScore(db: SupabaseClient, rows: CountryG7DebtRow[]): Promise<{ score: number | null; stage: G7CrisisStageDef | null }> {
  const gdpKeys = G7_COUNTRIES.map((c) => `g7.${c.key}.gdp_current_usd`);
  const gdp = await fetchLatestForKeys(db, gdpKeys);

  const weighted: { score: number; weight: number }[] = [];
  for (let i = 0; i < G7_COUNTRIES.length; i++) {
    const c = G7_COUNTRIES[i];
    const row = rows[i];
    const gdpRow = gdp.get(`g7.${c.key}.gdp_current_usd`);
    if (row.vulnerabilityScore !== null && gdpRow) weighted.push({ score: row.vulnerabilityScore, weight: gdpRow.v });
  }
  if (weighted.length === 0) return { score: null, stage: null };
  const totalWeight = weighted.reduce((a, b) => a + b.weight, 0);
  const score = Math.round(weighted.reduce((a, b) => a + b.score * b.weight, 0) / totalWeight);
  return { score, stage: g7CrisisStageFor(score, false, false) };
}

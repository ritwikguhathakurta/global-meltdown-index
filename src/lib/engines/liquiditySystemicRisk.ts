import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, subtractSeriesByDate, previousOf, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { BANKING_COUNTRIES } from "../sources/bankFinancialSoundness";
import { type FsrRegion, FSR_REGION_ORDER } from "../data/centralBankFsrRegistry";

/**
 * Global Liquidity Systemic Risk — built against a 256-section institutional
 * spec ("Global Liquidity Systemic Risk Engine": funding/market/central-bank/
 * FX/dollar/repo/collateral/margin/NBFI/capital-flows/contagion liquidity
 * across a G7+G20+ASEAN+CEE+LatAm+Middle East+Africa country universe, 16
 * liquidity sub-indices, a Global Liquidity Command Center with a shock
 * simulator, historical backtests to 1987, a daily 8am report and AI Q&A
 * layer...). Checked component by component against what free, verified
 * data genuinely supports for a multi-country universe at once — the same
 * discipline already applied to Carry Trade, G7 Debt, EM Debt, Banking and
 * Property. This module is the country-level "how tight is funding/market
 * liquidity right now" layer; getGlobalDollarLiquidityIndex below is the
 * separate global-currency layer (spec's own §12-16 "BIS Global Liquidity
 * Engine", genuinely distinct from a per-country reading).
 *
 * This deliberately does NOT touch the existing "global_liquidity"
 * GFMI-weighted engine (globalLiquidity.ts) or its per-bank
 * AMPLE/ADEQUATE/TIGHTENING/DEFICIT classifier (liquidityRegime.ts) — same
 * "new analytical layer, not a second GFMI vote" pattern as every other
 * *SystemicRisk.ts module.
 *
 * COUNTRY UNIVERSE (LIQUIDITY_COUNTRIES): expanded from the original nine
 * (BANKING_COUNTRIES — G7 + China + India) to 22, covering the spec's own
 * §6 G20/ASEAN/CEE/Latin America/Africa ask (region field reuses
 * centralBankFsrRegistry.ts's FsrRegion/FSR_REGION_ORDER, the same grouping
 * already used on the Banking/Credit pages' verification tables, so a
 * reader sees the same country-to-region mapping everywhere in this app).
 * Every new country's REPO/FX metric keys were checked against what this
 * app's fred.ts/fx.ts connectors already fetch (verified present, not
 * assumed) before being wired in here — no new connectors were needed for
 * the 13 additions, since a wide interbank-rate and FX-cross-rate manifest
 * was already built for the Carry Trade and EM Debt engines.
 *
 * Two of this engine's four domains (Central Bank Liquidity, Bond Market
 * Liquidity) remain genuinely nine-country-only: no free FX-reserves
 * connector exists beyond China (chinaFxReserves.ts), and no free daily/
 * monthly 10-year government-bond-yield series was found for any of the 13
 * new countries (checked FRED's OECD-mirrored long-term-rate family and the
 * BIS/national-source options already used for the original nine — none
 * cover these 13). The other two domains (Repo/Money-Market, FX Liquidity)
 * DO extend to most of the 13, using each country's already-tracked
 * interbank/discount rate (LEVEL, not spread — none of these 13 have a free
 * daily policy-rate series to pair against, the same disclosed limitation
 * Japan/China/India already have) and USD cross rate. The existing
 * weighted-renormalization logic (structural/market scores average only
 * the domains that actually have data, reweighting the denominator rather
 * than treating a missing domain as zero) means a country with only 1-2 of
 * 4 domains still gets an honest score built from what it has — not a
 * fabricated stand-in for what it doesn't.
 *
 * Checked and EXCLUDED (zero of the four domains have real, free, verified
 * data — a pegged or untracked currency with no interbank-rate series
 * either, not merely "not gotten to yet"): Saudi Arabia and the UAE (SAR/AED
 * are hard-pegged to USD — near-zero genuine FX volatility to measure even
 * if a series existed, and neither has a free interbank-rate series in this
 * app), Singapore (SGD has no ECB reference rate in this app's FX connector
 * and no free interbank-rate series either), Argentina and Russia (ARS/RUB
 * are both untracked in this app's FX connector, and neither has a free
 * interbank-rate series — Russia's for the additional reason that reliable
 * free market data has been disrupted since 2022). Also excluded, for the
 * same reason: Chile, Colombia, Israel, Romania, Peru, Egypt, Kenya,
 * Nigeria, Vietnam, Qatar and the major offshore financial centres (Hong
 * Kong, Cayman, Luxembourg, Singapore again) the spec separately calls
 * out — none have a free interbank-rate or FX-cross series in this app.
 * These are disclosed here rather than forced into the table with an
 * all-null row.
 *
 * FOUR DOMAINS:
 *
 *  - CENTRAL BANK LIQUIDITY (9 countries only): each country's own
 *    central-bank balance-sheet/reserves series, the EXACT SAME series and
 *    direction handling already wired into bankingSystemicRisk.ts's
 *    LIQUIDITY_KEY/LIQUIDITY_ZDIRECTION, reused rather than re-fetched.
 *  - MONEY MARKET / REPO STRESS (19 countries): the money-market-rate-vs-
 *    policy-rate SPREAD already used in liquidityRegime.ts (SOFR-IORB,
 *    SONIA-Bank Rate, €STR-Deposit Facility Rate, CORRA-Target) for the five
 *    with a clean pairing; every other country (Japan, China, India, and
 *    the 10 of 13 new countries with a tracked rate — Brazil, Mexico,
 *    Indonesia, South Korea, South Africa, Türkiye, Australia, Poland,
 *    Czech Republic, Hungary) is scored on its own money-market rate's
 *    LEVEL trend instead — a real but weaker signal than a spread,
 *    disclosed per-row via a distinct reading label.
 *  - BOND MARKET LIQUIDITY (9 countries only): realized volatility of each
 *    country's own 10-year government bond yield.
 *  - FX LIQUIDITY (21 countries): realized volatility of each country's own
 *    currency vs USD (DXY broad index for the US itself), extended to 12 of
 *    the 13 new countries (all except Malaysia/Thailand/Philippines being
 *    the same set — actually all 13 have a tracked FX cross; see
 *    LIQUIDITY_COUNTRIES below for the exact per-country domain coverage).
 *
 * STRUCTURAL VULNERABILITY = Central Bank Liquidity (50%) + Money Market/
 * Repo Stress (50%), renormalized to 100% Repo where Central Bank Liquidity
 * has no data (13 of 22 countries). MARKET = Bond Market Liquidity (50%) +
 * FX Liquidity (50%), renormalized to 100% FX Vol where Bond Market
 * Liquidity has no data (13 of 22 countries) — the same "average only what
 * exists, reweight the denominator" pattern used everywhere else in this
 * app, not a new mechanism built for this expansion.
 *
 * CONTAGION (breadth): the fraction of the OTHER 21 countries whose
 * preliminary Structural+Market blend is already elevated (>= 60).
 *
 * COMPOSITE = Structural (40%) + Market (35%) + Contagion (25%) — this
 * app's own house convention, unchanged by the country-count expansion.
 *
 * STAGE MODEL: unchanged 7-stage convention (see LIQUIDITY_STAGES below).
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * repo volumes/haircuts/specialness, collateral availability/concentration/
 * haircut-shock modeling, margin/CCP data, country-level NBFI numeric
 * leverage/redemption series (covered instead, qualitatively and globally
 * only, by nbfiRegistry.ts/nbfiCheck.ts), capital-flow/reserve-adequacy
 * metrics for non-China EM, a Liquidity Shock Simulator, historical
 * backtesting with lead-time analysis, an interactive contagion network
 * graph, and a daily 8am report/AI Q&A layer.
 */

export type LiquidityRegimeLabel = "ABUNDANT" | "NORMAL" | "TIGHTENING" | "FUNDING_STRESS" | "SYSTEMIC_LIQUIDITY_STRESS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): LiquidityRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "ABUNDANT";
  if (score < 40) return "NORMAL";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "FUNDING_STRESS";
  return "SYSTEMIC_LIQUIDITY_STRESS";
}

export type LiquidityStageKey =
  | "ABUNDANT"
  | "NORMALIZATION"
  | "MARKET_LIQUIDITY_WARNING"
  | "FUNDING_REPO_STRESS"
  | "BROAD_LIQUIDITY_STRESS"
  | "LIQUIDITY_CRISIS"
  | "SYSTEMIC_LIQUIDITY_CONTAGION";

export type LiquidityStageDef = {
  stage: number; // 1-7
  key: LiquidityStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const LIQUIDITY_STAGES: LiquidityStageDef[] = [
  { stage: 1, key: "ABUNDANT", label: "Stage 1 — Abundant Liquidity", shortLabel: "Abundant", description: "Central-bank reserves, money-market spreads, bond and FX volatility all sit within normal historical ranges." },
  { stage: 2, key: "NORMALIZATION", label: "Stage 2 — Normalization", shortLabel: "Normalization", description: "Structural readings (reserves, money-market spread) deteriorating while bond/FX market pricing hasn't reacted yet — genuinely computed, not asserted (spec's 'hidden risk')." },
  { stage: 3, key: "MARKET_LIQUIDITY_WARNING", label: "Stage 3 — Market Liquidity Warning", shortLabel: "Market Warning", description: "Bond-yield and/or FX volatility deteriorating well ahead of the underlying structural (reserves/funding) fundamentals." },
  { stage: 4, key: "FUNDING_REPO_STRESS", label: "Stage 4 — Funding / Repo Stress", shortLabel: "Funding Stress", description: "Blended score has crossed into the range this model treats as genuine money-market/reserve tightening." },
  { stage: 5, key: "BROAD_LIQUIDITY_STRESS", label: "Stage 5 — Broad Liquidity Stress", shortLabel: "Broad Stress", description: "Severe, broad-based deterioration across structural and market readings together — this app has no collateral/margin data to distinguish a narrower 'collateral spiral' stage, so this stays a general reading." },
  { stage: 6, key: "LIQUIDITY_CRISIS", label: "Stage 6 — Liquidity Crisis", shortLabel: "Liquidity Crisis", description: "Near the top of the observed stress range on this model's 0-100 scale." },
  { stage: 7, key: "SYSTEMIC_LIQUIDITY_CONTAGION", label: "Stage 7 — Systemic Liquidity Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL tracked countries are simultaneously at Stage 6 or worse — a breadth reading, never assigned to a single country in isolation." },
];

export const STRUCTURAL_WEIGHTS = { centralBankLiquidity: 0.5, repoStress: 0.5 };
export const MARKET_WEIGHTS = { bondVol: 0.5, fxVol: 0.5 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, market: 0.35, contagion: 0.25 };

function stageNumberFromScore(score: number): number {
  if (score < 15) return 1;
  if (score < 30) return 2;
  if (score < 45) return 3;
  if (score < 60) return 4;
  if (score < 75) return 5;
  if (score < 90) return 6;
  return 7;
}

export function liquidityStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean): LiquidityStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  return LIQUIDITY_STAGES[Math.min(stage, 6) - 1]; // per-country rows cap at Stage 6; Stage 7 is composite-only
}

// ---------------------------------------------------------------------------
// Country universe
// ---------------------------------------------------------------------------

export type LiquidityCountry = { key: string; name: string; region: FsrRegion };

const ORIGINAL_NINE: LiquidityCountry[] = BANKING_COUNTRIES.map((c) => ({
  key: c.key,
  name: c.name,
  region: c.key === "china" || c.key === "india" ? "G20 / Major EM" : "G7",
}));

/** The 13-country expansion — see file header for exactly which of the four
 * domains each one has real data for, and which countries were checked and
 * excluded for having none. */
const EXPANDED_COUNTRIES: LiquidityCountry[] = [
  { key: "brazil", name: "Brazil", region: "G20 / Major EM" },
  { key: "mexico", name: "Mexico", region: "G20 / Major EM" },
  { key: "indonesia", name: "Indonesia", region: "G20 / Major EM" },
  { key: "south_korea", name: "South Korea", region: "G20 / Major EM" },
  { key: "south_africa", name: "South Africa", region: "G20 / Major EM" },
  { key: "turkey", name: "Türkiye", region: "G20 / Major EM" },
  { key: "australia", name: "Australia", region: "G20 / Major EM" },
  { key: "poland", name: "Poland", region: "CEE" },
  { key: "czech_republic", name: "Czech Republic", region: "CEE" },
  { key: "hungary", name: "Hungary", region: "CEE" },
  { key: "malaysia", name: "Malaysia", region: "ASEAN" },
  { key: "thailand", name: "Thailand", region: "ASEAN" },
  { key: "philippines", name: "Philippines", region: "ASEAN" },
];

export const LIQUIDITY_COUNTRIES: LiquidityCountry[] = [...ORIGINAL_NINE, ...EXPANDED_COUNTRIES];
export { FSR_REGION_ORDER as LIQUIDITY_REGION_ORDER };

/** Same central-bank balance-sheet/reserves series as bankingSystemicRisk.ts's
 * LIQUIDITY_KEY, reused rather than re-fetched. Nine-country-only — see file
 * header for why no free FX-reserves series exists beyond China. */
const CENTRAL_BANK_LIQUIDITY_KEY: Record<string, string> = {
  us: "liquidity.fed_reserve_balances",
  uk: "liquidity.uk_boe_reserves",
  germany: "liquidity.ecb_balance_sheet",
  france: "liquidity.ecb_balance_sheet",
  italy: "liquidity.ecb_balance_sheet",
  japan: "liquidity.boj_balance_sheet",
  canada: "liquidity.canada_boc_assets",
  china: "liquidity.china_reserves_ex_gold",
  india: "india.rbi_net_liquidity",
};
const CENTRAL_BANK_LIQUIDITY_ZDIRECTION: Record<string, 1 | -1> = {
  us: -1, uk: -1, germany: -1, france: -1, italy: -1, japan: -1, canada: -1, china: -1, india: 1,
};
const CENTRAL_BANK_LIQUIDITY_FREQ: Record<string, "daily" | "weekly" | "monthly"> = {
  us: "weekly", uk: "weekly", germany: "weekly", france: "weekly", italy: "weekly",
  japan: "monthly", canada: "weekly", china: "monthly", india: "daily",
};

/** Money-market rate vs. policy rate, for the five with a clean pairing.
 * Every other tracked country instead uses a single LEVEL series (their own
 * money-market/interbank/discount rate, no policy-rate pairing available). */
type RepoBasis = { kind: "spread"; marketKey: string; policyKey: string } | { kind: "level"; rateKey: string; label: string };
const REPO_BASIS: Record<string, RepoBasis> = {
  us: { kind: "spread", marketKey: "rate.sofr", policyKey: "rate.us_iorb" },
  uk: { kind: "spread", marketKey: "rate.uk_sonia", policyKey: "rate.uk_bank_rate" },
  germany: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  france: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  italy: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  canada: { kind: "spread", marketKey: "rate.canada_corra", policyKey: "rate.canada_target" },
  japan: { kind: "level", rateKey: "rate.japan_call_rate", label: "O/N Call Rate (level)" },
  china: { kind: "level", rateKey: "china.interbank_rate_3m", label: "3M Interbank Rate (level)" },
  india: { kind: "level", rateKey: "india.wacr", label: "WACR (level)" },
  brazil: { kind: "level", rateKey: "rate.brazil_discount", label: "Discount Rate (level, ≠ Selic)" },
  mexico: { kind: "level", rateKey: "rate.mexico_interbank", label: "Interbank Rate (level)" },
  indonesia: { kind: "level", rateKey: "rate.indonesia_interbank", label: "Interbank Rate (level)" },
  south_korea: { kind: "level", rateKey: "rate.korea_interbank", label: "Interbank Rate (level)" },
  south_africa: { kind: "level", rateKey: "rate.south_africa_interbank", label: "Interbank Rate (level)" },
  turkey: { kind: "level", rateKey: "rate.turkey_interbank", label: "Interbank Rate (level)" },
  australia: { kind: "level", rateKey: "rate.australia_interbank", label: "Interbank Rate (level)" },
  poland: { kind: "level", rateKey: "rate.poland_interbank", label: "Interbank Rate (level)" },
  czech_republic: { kind: "level", rateKey: "rate.czech_interbank", label: "Interbank Rate (level)" },
  hungary: { kind: "level", rateKey: "rate.hungary_interbank", label: "Interbank Rate (level)" },
  // Malaysia, Thailand, Philippines: no free short-term rate series found
  // anywhere in this app (checked OECD MEI "Immediate Rate"/"3M interbank"
  // families directly — see fred.ts's own comment) — absent from this map
  // entirely, not defaulted to a fake value.
};

const SPREAD_LABEL: Record<string, string> = {
  us: "SOFR − IORB", uk: "SONIA − Bank Rate",
  germany: "€STR − Deposit Facility Rate", france: "€STR − Deposit Facility Rate", italy: "€STR − Deposit Facility Rate",
  canada: "CORRA − Target",
};

/** Each country's own 10-year government bond yield — nine-country-only, see
 * file header for why. */
const BOND_YIELD_KEY: Record<string, string> = {
  us: "yield.us10y",
  uk: "yield.uk_10y",
  germany: "yield.germany_10y",
  france: "yield.france_10y",
  italy: "yield.italy_10y",
  japan: "yield.japan_10y",
  canada: "yield.canada_10y",
  china: "yield.china_10y",
  india: "india.gsec_10y",
};
const BOND_YIELD_FREQ: Record<string, "daily" | "monthly"> = {
  us: "daily", uk: "daily", germany: "daily", canada: "daily", japan: "daily",
  france: "monthly", italy: "monthly", china: "daily", india: "monthly",
};

/** Each country's own currency vs USD — DXY broad index stands in for the US
 * itself. Extended to 12 of the 13 new countries (all except none — every
 * one of the 13 has a tracked USD cross in fx.ts). */
const FX_KEY: Record<string, string> = {
  us: "fx.dxy_broad",
  uk: "fx.usdgbp",
  germany: "fx.usdeur",
  france: "fx.usdeur",
  italy: "fx.usdeur",
  japan: "fx.usdjpy",
  canada: "fx.usdcad",
  china: "fx.usdcny",
  india: "fx.usdinr",
  brazil: "fx.usdbrl",
  mexico: "fx.usdmxn",
  indonesia: "fx.usdidr",
  south_korea: "fx.usdkrw",
  south_africa: "fx.usdzar",
  turkey: "fx.usdtry",
  australia: "fx.usdaud",
  poland: "fx.usdpln",
  czech_republic: "fx.usdczk",
  hungary: "fx.usdhuf",
  malaysia: "fx.usdmyr",
  thailand: "fx.usdthb",
  philippines: "fx.usdphp",
};

function windowForFreq(freq: "daily" | "weekly" | "monthly"): number {
  switch (freq) {
    case "daily":
    case "weekly":
      return 252;
    case "monthly":
      return 36;
  }
}

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

async function fetchIfKeyed(db: SupabaseClient, key: string | undefined, sinceIso: string): Promise<Point[]> {
  return key ? fetchSeries(db, key, sinceIso) : [];
}

export type LiquidityIndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

export type CountryLiquidityRow = {
  country: string;
  region: FsrRegion;
  centralBankLiquidity: LiquidityIndicatorReading;
  repoReading: LiquidityIndicatorReading;
  repoBasisLabel: string;
  bondVolReading: LiquidityIndicatorReading;
  fxVolReading: LiquidityIndicatorReading;
  centralBankLiquidityScore: number | null;
  repoScore: number | null;
  bondVolScore: number | null;
  fxVolScore: number | null;
  structuralScore: number | null;
  marketScore: number | null;
  contagionScore: number | null;
  compositeScore: number | null;
  regime: LiquidityRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
};

export async function getLiquiditySystemicRiskTable(db: SupabaseClient): Promise<CountryLiquidityRow[]> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceWeekly = new Date();
  sinceWeekly.setUTCDate(sinceWeekly.getUTCDate() - lookbackDaysFor("weekly"));
  const sinceMonthly = new Date();
  sinceMonthly.setUTCDate(sinceMonthly.getUTCDate() - lookbackDaysFor("monthly"));
  const sinceFor = (freq: "daily" | "weekly" | "monthly") =>
    (freq === "daily" ? sinceDaily : freq === "weekly" ? sinceWeekly : sinceMonthly).toISOString();

  const cbLiquiditySeries = new Map(
    await Promise.all(
      LIQUIDITY_COUNTRIES.map(async (c) => {
        const key = CENTRAL_BANK_LIQUIDITY_KEY[c.key];
        const freq = CENTRAL_BANK_LIQUIDITY_FREQ[c.key] ?? "monthly";
        return [c.key, await fetchIfKeyed(db, key, sinceFor(freq))] as const;
      })
    )
  );

  const repoSeries = new Map(
    await Promise.all(
      LIQUIDITY_COUNTRIES.map(async (c) => {
        const basis = REPO_BASIS[c.key];
        if (!basis) return [c.key, [] as Point[]] as const;
        if (basis.kind === "level") {
          return [c.key, await fetchSeries(db, basis.rateKey, sinceDaily.toISOString())] as const;
        }
        const [market, policy] = await Promise.all([
          fetchSeries(db, basis.marketKey, sinceDaily.toISOString()),
          fetchSeries(db, basis.policyKey, sinceDaily.toISOString()),
        ]);
        const spread = subtractSeriesByDate(market, policy).map((p) => ({ t: p.t, v: p.v * 100 })); // pp -> bps
        return [c.key, spread] as const;
      })
    )
  );

  const bondYieldSeries = new Map(
    await Promise.all(
      LIQUIDITY_COUNTRIES.map(async (c) => {
        const key = BOND_YIELD_KEY[c.key];
        const freq = BOND_YIELD_FREQ[c.key] ?? "daily";
        return [c.key, await fetchIfKeyed(db, key, sinceFor(freq))] as const;
      })
    )
  );

  const fxSeries = new Map(
    await Promise.all(LIQUIDITY_COUNTRIES.map(async (c) => [c.key, await fetchIfKeyed(db, FX_KEY[c.key], sinceDaily.toISOString())] as const))
  );

  // Pass 1: structural + market scores per country (contagion needs these
  // first, since it's a breadth measure over the whole tracked set).
  const prelim = LIQUIDITY_COUNTRIES.map((c) => {
    const cbSeries = cbLiquiditySeries.get(c.key) ?? [];
    const cbScore =
      cbSeries.length > 0 ? zToRiskScore(zScore(cbSeries, windowForFreq(CENTRAL_BANK_LIQUIDITY_FREQ[c.key] ?? "monthly")), CENTRAL_BANK_LIQUIDITY_ZDIRECTION[c.key] ?? -1) : null;

    const repoSeriesForCountry = repoSeries.get(c.key) ?? [];
    const repoScore = repoSeriesForCountry.length > 0 ? zToRiskScore(zScore(repoSeriesForCountry, windowForFreq("daily")), 1) : null;

    const structParts = [
      cbScore !== null ? { score: cbScore, weight: STRUCTURAL_WEIGHTS.centralBankLiquidity } : null,
      repoScore !== null ? { score: repoScore, weight: STRUCTURAL_WEIGHTS.repoStress } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const structuralScore =
      structParts.length > 0
        ? Math.round(structParts.reduce((a, b) => a + b.score * b.weight, 0) / structParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const bondSeries = bondYieldSeries.get(c.key) ?? [];
    const bondVolScore = bondSeries.length > 0 ? zToRiskScore(zScore(rollingRealizedVolSeries(bondSeries), windowForFreq(BOND_YIELD_FREQ[c.key] ?? "daily")), 1) : null;

    const fxSeriesForCountry = fxSeries.get(c.key) ?? [];
    const fxVolScore = fxSeriesForCountry.length > 0 ? zToRiskScore(zScore(rollingRealizedVolSeries(fxSeriesForCountry), windowForFreq("daily")), 1) : null;

    const marketParts = [
      bondVolScore !== null ? { score: bondVolScore, weight: MARKET_WEIGHTS.bondVol } : null,
      fxVolScore !== null ? { score: fxVolScore, weight: MARKET_WEIGHTS.fxVol } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const marketScore =
      marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b.score * b.weight, 0) / marketParts.reduce((a, b) => a + b.weight, 0)) : null;

    const prelimParts = [
      structuralScore !== null ? { score: structuralScore, weight: 0.55 } : null,
      marketScore !== null ? { score: marketScore, weight: 0.45 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const prelimScore =
      prelimParts.length > 0 ? prelimParts.reduce((a, b) => a + b.score * b.weight, 0) / prelimParts.reduce((a, b) => a + b.weight, 0) : null;

    return { c, cbScore, repoScore, bondVolScore, fxVolScore, structuralScore, marketScore, prelimScore };
  });

  return prelim.map(({ c, cbScore, repoScore, bondVolScore, fxVolScore, structuralScore, marketScore }) => {
    const others = prelim.filter((p) => p.c.key !== c.key);
    const othersWithData = others.filter((p) => p.prelimScore !== null).length;
    const othersStressed = others.filter((p) => p.prelimScore !== null && (p.prelimScore as number) >= 60).length;
    const contagionScore = othersWithData >= 4 ? Math.round((othersStressed / othersWithData) * 100) : null;

    const compositeParts = [
      structuralScore !== null ? { score: structuralScore, weight: COMPOSITE_WEIGHTS.structural } : null,
      marketScore !== null ? { score: marketScore, weight: COMPOSITE_WEIGHTS.market } : null,
      contagionScore !== null ? { score: contagionScore, weight: COMPOSITE_WEIGHTS.contagion } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const compositeScore =
      compositeParts.length > 0
        ? Math.round(compositeParts.reduce((a, b) => a + b.score * b.weight, 0) / compositeParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const cbLast = latestPoint(cbLiquiditySeries.get(c.key) ?? []);
    const repoLast = latestPoint(repoSeries.get(c.key) ?? []);
    const bondLast = latestPoint(rollingRealizedVolSeries(bondYieldSeries.get(c.key) ?? []));
    const fxLast = latestPoint(rollingRealizedVolSeries(fxSeries.get(c.key) ?? []));

    const basis = REPO_BASIS[c.key];
    const repoBasisLabel = !basis ? "Unavailable" : basis.kind === "spread" ? SPREAD_LABEL[c.key] ?? "Spread" : basis.label;

    const applicableScores = [cbScore, repoScore, bondVolScore, fxVolScore];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = liquidityStageFor(compositeScore, hiddenRisk, marketLedWarning);

    return {
      country: c.name,
      region: c.region,
      centralBankLiquidity: { value: cbLast?.v ?? null, asOf: cbLast?.t ?? null, score: cbScore, previousValue: previousOf(cbLiquiditySeries.get(c.key) ?? [])?.v ?? null },
      repoReading: { value: repoLast?.v ?? null, asOf: repoLast?.t ?? null, score: repoScore, previousValue: previousOf(repoSeries.get(c.key) ?? [])?.v ?? null },
      repoBasisLabel,
      bondVolReading: { value: bondLast?.v ?? null, asOf: bondLast?.t ?? null, score: bondVolScore, previousValue: previousOf(rollingRealizedVolSeries(bondYieldSeries.get(c.key) ?? []))?.v ?? null },
      fxVolReading: { value: fxLast?.v ?? null, asOf: fxLast?.t ?? null, score: fxVolScore, previousValue: previousOf(rollingRealizedVolSeries(fxSeries.get(c.key) ?? []))?.v ?? null },
      centralBankLiquidityScore: cbScore,
      repoScore,
      bondVolScore,
      fxVolScore,
      structuralScore,
      marketScore,
      contagionScore,
      compositeScore,
      regime: labelFromScore(compositeScore),
      hiddenRisk,
      marketLedWarning,
      dataCompleteness,
      stage: stageDef?.stage ?? null,
      stageLabel: stageDef?.shortLabel ?? "—",
    };
  });
}

export function liquidityBreadth(rows: CountryLiquidityRow[]): { stressedCount: number; totalWithData: number } {
  const stressedCount = rows.filter((r) => (r.compositeScore ?? 0) >= 60).length;
  const totalWithData = rows.filter((r) => r.compositeScore !== null).length;
  return { stressedCount, totalWithData };
}

/** Equal-weighted composite across all tracked countries, with the composite
 * stage promoted to 7 when a large share of ALL countries are simultaneously
 * at Stage 6+ — same breadth-driven promotion pattern as every sibling
 * engine's own composite function. */
export function getLiquidityCompositeScore(rows: CountryLiquidityRow[]): { score: number | null; stage: LiquidityStageDef | null } {
  const withData = rows.filter((r) => r.compositeScore !== null);
  if (withData.length === 0) return { score: null, stage: null };
  const score = Math.round(withData.reduce((a, b) => a + (b.compositeScore as number), 0) / withData.length);
  const { stressedCount, totalWithData } = liquidityBreadth(rows);
  const crisisCount = rows.filter((r) => (r.stage ?? 0) >= 6).length;
  const breadthFrac = totalWithData > 0 ? crisisCount / totalWithData : 0;

  let stageNum = stageNumberFromScore(score);
  if (breadthFrac >= 0.5) stageNum = 7;
  else if (breadthFrac >= 0.25) stageNum = Math.max(stageNum, 6);
  else if (stressedCount > 0) stageNum = Math.max(stageNum, 4);

  return { score, stage: LIQUIDITY_STAGES[Math.min(stageNum, 7) - 1] };
}

// ---------------------------------------------------------------------------
// Global Dollar/Euro/Yen Liquidity Index — spec's own §12-16 "BIS Global
// Liquidity Engine", genuinely distinct from the per-country table above.
// ---------------------------------------------------------------------------

export type DollarLiquidityReading = "EXPANDING" | "MODERATING" | "DECELERATING" | "CONTRACTING" | "INSUFFICIENT_DATA";

function readingFromGrowth(latestYoyPct: number | null, z: number | null): DollarLiquidityReading {
  if (latestYoyPct === null) return "INSUFFICIENT_DATA";
  if (latestYoyPct < 0) return "CONTRACTING";
  if (z !== null && z <= -1) return "DECELERATING";
  if (z !== null && z >= 1) return "EXPANDING";
  return "MODERATING";
}

export type GlobalLiquidityCurrencyRow = {
  label: string;
  metricKey: string;
  latestYoyPct: number | null;
  asOf: string | null;
  previousYoyPct: number | null;
  reading: DollarLiquidityReading;
  /** Own-history z-score of the growth rate itself — a rapid deceleration or
   * contraction in cross-border credit growth is spec's own §16 "Dollar
   * Liquidity Acceleration" early-warning read, not the raw growth level. */
  accelerationZ: number | null;
};

async function loadGliRow(db: SupabaseClient, label: string, metricKey: string): Promise<GlobalLiquidityCurrencyRow> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 12);
  const series = await fetchSeries(db, metricKey, since.toISOString());
  const last = latestPoint(series);
  const z = zScore(series, 36); // quarterly series, ~9-year rolling baseline
  return {
    label,
    metricKey,
    latestYoyPct: last?.v ?? null,
    asOf: last?.t ?? null,
    previousYoyPct: previousOf(series)?.v ?? null,
    reading: readingFromGrowth(last?.v ?? null, z),
    accelerationZ: z,
  };
}

export async function getGlobalDollarLiquidityIndex(db: SupabaseClient): Promise<GlobalLiquidityCurrencyRow[]> {
  return Promise.all([
    loadGliRow(db, "USD credit to non-US non-banks", "liquidity.global_usd_credit_growth_ex_us"),
    loadGliRow(db, "EUR credit to non-euro-area non-banks", "liquidity.global_eur_credit_growth_ex_euro_area"),
    loadGliRow(db, "JPY credit to non-Japan non-banks", "liquidity.global_jpy_credit_growth_ex_japan"),
    loadGliRow(db, "USD credit to EM/developing non-banks", "liquidity.em_usd_credit_growth"),
  ]);
}

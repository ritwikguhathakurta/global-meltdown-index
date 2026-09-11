import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, subtractSeriesByDate, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { BANKING_COUNTRIES } from "../sources/bankFinancialSoundness";

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
 * Engine", genuinely distinct from a per-country reading — BIS's Global
 * Liquidity Indicators are compiled by CURRENCY and borrower REGION, not by
 * individual country, so folding them into a per-country z-score would
 * misrepresent what the underlying data actually measures).
 *
 * This deliberately does NOT touch the existing "global_liquidity"
 * GFMI-weighted engine (globalLiquidity.ts) or its per-bank
 * AMPLE/ADEQUATE/TIGHTENING/DEFICIT classifier (liquidityRegime.ts) — same
 * "new analytical layer, not a second GFMI vote" pattern as every other
 * *SystemicRisk.ts module (spec's own §175 "Double-Counting Control"). Both
 * existing modules' series are reused here rather than re-fetched.
 *
 * COUNTRY UNIVERSE: the same nine countries as bankingSystemicRisk.ts and
 * propertySystemicRisk.ts (BANKING_COUNTRIES) — deliberately, not a
 * coincidence: this is what makes the Transmission panel in engineData.ts
 * genuinely joinable across five engines on one country key, rather than
 * five different country lists that only partially overlap. Spec's own
 * broader ask (G20/ASEAN/CEE/Latin America/Middle East/Africa, §6) is the
 * same universe the Central Bank FSR and Credit Data Verification tables on
 * the Banking/Credit pages already cover with real per-country institution/
 * report/BIS-credit-gap data — extending THIS engine's own five domains
 * (below) to those 25 additional countries would need per-country repo/
 * policy-rate and bond-yield series this pass did not find free, verified,
 * live sources for beyond the nine already wired in elsewhere in this app;
 * disclosed as deferred rather than backfilled with a weaker proxy.
 *
 * FOUR DOMAINS (spec's own §2 six-way liquidity taxonomy — funding, market,
 * central-bank, collateral, FX, cross-border, balance-sheet, systemic —
 * trimmed to the four this pass has genuine free daily/weekly data for；
 * "systemic" is computed as the usual breadth-based Contagion score, exactly
 * like every other *SystemicRisk.ts module, not its own indicator domain):
 *
 *  - CENTRAL BANK LIQUIDITY: each country's own central-bank balance-sheet/
 *    reserves series, the EXACT SAME series and EXACT SAME direction
 *    handling already wired into bankingSystemicRisk.ts's LIQUIDITY_KEY/
 *    LIQUIDITY_ZDIRECTION (Fed reserve balances, BoE reserves, ECB balance
 *    sheet, BoJ balance sheet, BoC assets, China reserves-ex-gold, India's
 *    RBI net liquidity injection — reused rather than re-fetched, own-history
 *    time-series z-score).
 *  - MONEY MARKET / REPO STRESS: the same money-market-rate-vs-policy-rate
 *    SPREAD already used for the AMPLE/ADEQUATE/TIGHTENING/DEFICIT
 *    classification in liquidityRegime.ts (SOFR-IORB, SONIA-Bank Rate,
 *    €STR-Deposit Facility Rate for Germany/France/Italy, CORRA-Target) for
 *    the five where a clean policy-rate pairing exists — the actual
 *    mechanism behind the September 2019 US repo spike (market rate prints
 *    at/above policy rate = reserves getting scarce). Japan, China and India
 *    have no free daily policy/target-rate series to pair against (same
 *    disclosed limitation as liquidityRegime.ts for the first two; India's
 *    own WACR has no clean paired repo-rate series in this app yet either),
 *    so those three are scored on their own money-market rate's LEVEL trend
 *    instead (BOJ call rate, China 3M interbank, India's WACR) — a real but
 *    weaker signal than a spread, disclosed per-row via a distinct reading
 *    label, not silently blended in as equivalent.
 *  - BOND MARKET LIQUIDITY: realized volatility of each country's own 10-year
 *    government bond yield (own-history time-series z, elevated vol = worse)
 *    — a genuine, if partial, market-liquidity proxy (spec §80-92's own
 *    bid/ask-depth-turnover ask needs dealer-level microstructure data no
 *    free source publishes; yield volatility is the closest free daily
 *    signal that a bond market is having to reprice in a disorderly way).
 *  - FX LIQUIDITY: realized volatility of each country's own currency vs USD
 *    (DXY broad index for the US itself, since USD has no bilateral pair
 *    against itself) — same realized-vol mechanism as Bond Market Liquidity,
 *    reusing FX series already flowing from fx.ts.
 *
 * STRUCTURAL VULNERABILITY = Central Bank Liquidity (50%) + Money Market/
 * Repo Stress (50%) — the two domains that describe how much reserve/funding
 * buffer exists structurally, mirroring how bankingSystemicRisk.ts folds its
 * own "funding" and "liquidity" domains into Structural.
 *
 * MARKET = Bond Market Liquidity (50%) + FX Liquidity (50%) — the two
 * domains that describe whether liquidity stress is ALREADY showing up in
 * market pricing right now.
 *
 * CONTAGION (spec §110/133, simplified to a breadth reading exactly like
 * every sibling engine): the fraction of the OTHER eight countries whose
 * preliminary Structural+Market blend is already elevated (>= 60). A genuine
 * cross-border interbank/repo exposure network (spec §107-111, needs BIS
 * Locational Banking Statistics bilateral claims data) is a real future
 * addition, not attempted this pass.
 *
 * COMPOSITE = Structural (40%) + Market (35%) + Contagion (25%) — this app's
 * own house convention (see bankingSystemicRisk.ts/propertySystemicRisk.ts/
 * carryTrade.ts/g7DebtRegime.ts), applied verbatim rather than spec's own
 * §4 "40/35/25 normal, shifting under stress/crisis" regime-dependent
 * weighting — no other engine in this app implements that regime-switch
 * either, kept consistent rather than making Liquidity a one-off exception.
 *
 * STAGE MODEL: spec's own 8-stage list (§126: Abundant/Normalization/
 * Tightening/Funding Stress/Market Liquidity Stress/Collateral-Margin
 * Stress/Forced Deleveraging/Systemic Crisis) compressed to this app's
 * standard 7-stage convention — deliberately RELABELED rather than copied
 * verbatim: this engine has no collateral-haircut or margin-call data (spec
 * §49-61, no free source), so a stage literally named "Collateral/Margin
 * Stress" would overclaim what's actually measured. The relabeled stages
 * below stay honest about covering only funding, central-bank-reserve and
 * market(bond+FX)-liquidity — never collateral, margin, or NBFI redemption
 * mechanics directly (those are disclosed qualitatively in the NBFI registry
 * and the Transmission panel instead, not folded into this numeric score).
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * repo VOLUMES/haircuts/specialness (§43-48, no free source publishes
 * cross-country repo market depth), collateral availability/concentration/
 * haircut-shock modeling (§49-55), margin/CCP data (§56-61), NBFI-specific
 * numeric leverage/redemption/liquidity-mismatch series per country (§67-79
 * — covered instead, qualitatively and at the global level only, by
 * nbfiRegistry.ts/nbfiCheck.ts, since no free source publishes country-level
 * NBFI balance-sheet data), capital-flow/reserve-adequacy metrics for
 * non-China EM (§95-104, would need per-country FX-reserves and external-
 * debt series this app doesn't have beyond China), a Liquidity Shock
 * Simulator (§124-125, 211-213), historical backtesting with lead-time
 * analysis (§179-186), an interactive contagion network graph (§109-111,
 * 210), and a daily 8am report/AI Q&A layer (§214-220).
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
  { stage: 7, key: "SYSTEMIC_LIQUIDITY_CONTAGION", label: "Stage 7 — Systemic Liquidity Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL nine tracked countries are simultaneously at Stage 6 or worse — a breadth reading, never assigned to a single country in isolation." },
];

/** Fixed weights, exported so the dashboard's score-breakdown UI derives
 * contributions from the same numbers the engine actually used — same
 * pattern as bankingSystemicRisk.ts's STRUCTURAL_WEIGHTS/COMPOSITE_WEIGHTS. */
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

/** Same central-bank balance-sheet/reserves series as bankingSystemicRisk.ts's
 * LIQUIDITY_KEY, reused rather than re-fetched. */
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

/** Money-market rate vs. policy rate, for the five with a clean pairing —
 * same series as liquidityRegime.ts. Japan/China/India instead use a single
 * level series (their own money-market rate with no policy-rate pairing). */
type RepoBasis = { kind: "spread"; marketKey: string; policyKey: string } | { kind: "level"; rateKey: string };
const REPO_BASIS: Record<string, RepoBasis> = {
  us: { kind: "spread", marketKey: "rate.sofr", policyKey: "rate.us_iorb" },
  uk: { kind: "spread", marketKey: "rate.uk_sonia", policyKey: "rate.uk_bank_rate" },
  germany: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  france: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  italy: { kind: "spread", marketKey: "rate.ecb_estr", policyKey: "rate.ecb_deposit_facility" },
  canada: { kind: "spread", marketKey: "rate.canada_corra", policyKey: "rate.canada_target" },
  japan: { kind: "level", rateKey: "rate.japan_call_rate" },
  china: { kind: "level", rateKey: "china.interbank_rate_3m" },
  india: { kind: "level", rateKey: "india.wacr" },
};

/** Each country's own 10-year government bond yield — used for realized-vol,
 * not level. */
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
 * itself (USD has no bilateral pair against itself). */
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

export type LiquidityIndicatorReading = { value: number | null; asOf: string | null; score: number | null };

export type CountryLiquidityRow = {
  country: string;
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
      BANKING_COUNTRIES.map(
        async (c) => [c.key, await fetchSeries(db, CENTRAL_BANK_LIQUIDITY_KEY[c.key], sinceFor(CENTRAL_BANK_LIQUIDITY_FREQ[c.key]))] as const
      )
    )
  );

  const repoSeries = new Map(
    await Promise.all(
      BANKING_COUNTRIES.map(async (c) => {
        const basis = REPO_BASIS[c.key];
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
      BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, BOND_YIELD_KEY[c.key], sinceFor(BOND_YIELD_FREQ[c.key]))] as const)
    )
  );

  const fxSeries = new Map(
    await Promise.all(BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, FX_KEY[c.key], sinceDaily.toISOString())] as const))
  );

  // Pass 1: structural + market scores per country (contagion needs these
  // first, since it's a breadth measure over the whole tracked set).
  const prelim = BANKING_COUNTRIES.map((c) => {
    const cbSeries = cbLiquiditySeries.get(c.key) ?? [];
    const cbScore = zToRiskScore(zScore(cbSeries, windowForFreq(CENTRAL_BANK_LIQUIDITY_FREQ[c.key])), CENTRAL_BANK_LIQUIDITY_ZDIRECTION[c.key]);

    const repoSeriesForCountry = repoSeries.get(c.key) ?? [];
    const repoScore = zToRiskScore(zScore(repoSeriesForCountry, windowForFreq("daily")), 1);

    const structParts = [
      cbScore !== null ? { score: cbScore, weight: STRUCTURAL_WEIGHTS.centralBankLiquidity } : null,
      repoScore !== null ? { score: repoScore, weight: STRUCTURAL_WEIGHTS.repoStress } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const structuralScore =
      structParts.length > 0
        ? Math.round(structParts.reduce((a, b) => a + b.score * b.weight, 0) / structParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const bondSeries = bondYieldSeries.get(c.key) ?? [];
    const bondVolScore = zToRiskScore(zScore(rollingRealizedVolSeries(bondSeries), windowForFreq(BOND_YIELD_FREQ[c.key])), 1);

    const fxSeriesForCountry = fxSeries.get(c.key) ?? [];
    const fxVolScore = zToRiskScore(zScore(rollingRealizedVolSeries(fxSeriesForCountry), windowForFreq("daily")), 1);

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
    const repoBasisLabel =
      basis.kind === "spread"
        ? { us: "SOFR − IORB", uk: "SONIA − Bank Rate", germany: "€STR − Deposit Facility Rate", france: "€STR − Deposit Facility Rate", italy: "€STR − Deposit Facility Rate", canada: "CORRA − Target" }[c.key] ?? "Spread"
        : { japan: "O/N Call Rate (level)", china: "3M Interbank Rate (level)", india: "WACR (level)" }[c.key] ?? "Level";

    const applicableScores = [cbScore, repoScore, bondVolScore, fxVolScore];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = liquidityStageFor(compositeScore, hiddenRisk, marketLedWarning);

    return {
      country: c.name,
      centralBankLiquidity: { value: cbLast?.v ?? null, asOf: cbLast?.t ?? null, score: cbScore },
      repoReading: { value: repoLast?.v ?? null, asOf: repoLast?.t ?? null, score: repoScore },
      repoBasisLabel,
      bondVolReading: { value: bondLast?.v ?? null, asOf: bondLast?.t ?? null, score: bondVolScore },
      fxVolReading: { value: fxLast?.v ?? null, asOf: fxLast?.t ?? null, score: fxVolScore },
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

/** Equal-weighted composite across the nine tracked countries, with the
 * composite stage promoted to 7 when a large share of ALL countries are
 * simultaneously at Stage 6+ — same breadth-driven promotion pattern as
 * every sibling engine's own composite function. */
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

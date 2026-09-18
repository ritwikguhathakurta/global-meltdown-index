import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries, fetchLatestForKeys } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, previousOf, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { BANKING_COUNTRIES } from "../sources/bankFinancialSoundness";

/**
 * Global Banking Systemic Risk — built against a 200-section institutional
 * spec ("Global Banking Systemic Risk Engine": per-bank capital/liquidity/
 * funding/CRE/mortgage/sovereign-exposure/derivatives tracking across a
 * bank_master universe of G-SIBs and D-SIBs, an interbank contagion network,
 * 10 stress scenarios with deposit-outflow/wholesale-funding/collateral-
 * haircut ladders, historical backtesting to the 1990s Japanese banking
 * crisis, a daily 8am report and AI Q&A layer...). Checked component by
 * component against what free, verified data genuinely supports for a
 * multi-country universe at once — the same discipline applied to Carry
 * Trade, G7 Debt and EM Debt. What's built here is the genuinely
 * free-data-backed COUNTRY-LEVEL subset (spec §7-9's bank-by-bank universe
 * is instead covered, for US banks only, by bankLevel.ts/bankSecFilings.ts/
 * fdicBankFind.ts — real holding-company GAAP data from SEC EDGAR plus real
 * regulatory CET1/leverage/NPL/CRE ratios from the FDIC BankFind API; every
 * other jurisdiction's individual G-SIBs/D-SIBs, Stage 2 migration, deposit
 * concentration and derivatives notional remain disclosed as deferred — no
 * free source publishes structured, machine-readable bank-by-bank
 * regulatory filings outside the US); see the methodology page for the full
 * breakdown, including which additional sources (EBA Pillar 3 Data Hub, EBA
 * Transparency Exercise, RBI DBIE, Banco Central do Brasil, BDDK) were
 * checked live and why each was or wasn't built on.
 *
 * This deliberately does NOT touch the existing "banking" GFMI-weighted
 * engine (banking.ts) or register a second GFMI vote — same "new analytical
 * layer, not a second count" pattern as carryTrade.ts and g7DebtRegime.ts
 * (spec's own §141 "Double-Counting Control" instruction). The existing
 * banking.ts engine keeps its own six US/Euro-area/UK inputs unchanged.
 *
 * COUNTRY UNIVERSE: the seven G7 economies (reusing BANKING_COUNTRIES, same
 * keys as g7Fiscal.ts's G7_COUNTRIES) plus China and India — the subset of
 * the spec's 21-country minimum (§7) where free, verifiable bank-soundness
 * data was actually found live this pass. Eurozone as its own standalone
 * aggregate (distinct from Germany/France/Italy), Australia, South Korea,
 * Singapore, Hong Kong, Brazil, Mexico, Indonesia, South Africa, Turkiye,
 * Saudi Arabia and UAE are not covered — checked, disclosed as deferred.
 *
 * FIVE DOMAINS (spec §5's six trimmed to five — "Systemic Contagion" is
 * computed as a breadth measure below rather than its own indicator domain,
 * same as G7 Debt's "funding/contagion"):
 *
 *  - CAPITAL: World Bank "Bank capital to assets ratio" (a leverage ratio,
 *    NOT risk-weighted CET1 — no free source for that cross-country; see
 *    bankFinancialSoundness.ts), cross-sectionally z-scored against the
 *    other eight countries (lower ratio = higher risk).
 *  - CREDIT: World Bank "Bank NPL to gross loans" ratio (cross-sectional z,
 *    higher = worse) for all nine, blended for the US with the existing
 *    banking.ts engine's own delinquency/charge-off/CRE-delinquency series
 *    (own-history time-series z, CRE weighted highest as the earliest-moving
 *    per banking.ts's own finding), and for UK/Canada/Japan with the
 *    existing BIS credit-to-GDP gap series already tracked in
 *    creditRegime.ts (own-history time-series z — a genuine credit-boom-
 *    excess signal, spec §32-33).
 *  - FUNDING: each country's own short-term policy/interbank rate — reusing
 *    the exact same rate series wired in for the Global Carry Trade engine
 *    (carryTrade.ts/fred.ts) rather than re-fetching — own-history
 *    time-series z, higher rate = higher funding cost = higher risk.
 *  - LIQUIDITY: each country's own central-bank balance-sheet/reserves
 *    series already flowing from globalLiquidity.ts/liquidityRegime.ts
 *    (Fed reserve balances, BoE reserves, ECB balance sheet, BoJ balance
 *    sheet, BoC assets, China reserves-ex-gold, India's RBI net liquidity
 *    injection) — own-history time-series z. Direction is per-country: a
 *    DECLINING balance sheet/reserve level signals liquidity tightening
 *    (risk up) for six of the seven; India's series is the RBI's own net
 *    injection amount (positive = banks needed liquidity support), so a
 *    RISING value there signals the same underlying stress in the opposite
 *    raw-value direction — handled explicitly via LIQUIDITY_ZDIRECTION, not
 *    a single constant. A dedicated cross-country "bank liquid reserves to
 *    assets" ratio (World Bank FD.RES.LIQU.AS.ZS) was checked and rejected:
 *    verified live to have NO data at all for six of the nine countries.
 *  - MARKET: a bank-sector equity index/ETF per country (US KBW Bank Index,
 *    a European bank-sector ETF for Germany/France/Italy, Barclays as a
 *    single-bank UK proxy, a TOPIX Banks ETF for Japan, a Canadian bank ETF,
 *    ICBC as a single-bank China proxy, the Nifty Bank Index for India — see
 *    yahooIndex.ts for exactly which ticker and why; no free source
 *    publishes bank CDS or a uniform cross-country bank-equity index API).
 *    Blends the index level's own-history z-score (price below trend =
 *    stress, 60% weight) with its realized volatility's own-history z-score
 *    (elevated vol = stress, 40% weight).
 *
 * STRUCTURAL VULNERABILITY = Capital (35%) + Credit (30%) + Funding (15%) +
 * Liquidity (20%) — a free-data-scoped mapping of spec §88's Capital 40/
 * Credit 25/Funding 20/Balance-Sheet 15 framing (this engine folds
 * "liquidity" in where spec keeps a separate balance-sheet/duration domain,
 * since IRRBB/duration-gap data needs bank-level disclosures this pass
 * doesn't have).
 *
 * CONTAGION (spec §87, simplified to a breadth reading exactly like G7
 * Debt's own funding/contagion score): the fraction of the OTHER eight
 * countries whose preliminary Structural+Market blend is already elevated
 * (>= 60). Not yet a bilateral cross-border-exposure-weighted network (spec
 * §59-60, needs BIS International Banking Statistics bilateral claims data —
 * checked, a real future addition, not attempted this pass) or a bank-
 * equity/sovereign-yield correlation regime (spec §139 — a real, computable
 * addition using data already in this engine, deferred for scope this pass,
 * not for lack of a free source).
 *
 * COMPOSITE = Structural (40%) + Market (35%) + Contagion (25%) — spec
 * §90's own base weighting, applied verbatim even though the domains
 * feeding "Structural" here are the free-data-scoped subset above.
 *
 * STAGE MODEL: spec's own STAGE 0-7 (§92, eight named stages) is compressed
 * to this app's standard 7-stage convention (same renumbering already used
 * for Carry Trade/G7 Debt/EM Debt) — spec's separate "Capital Stress" stage
 * is folded into "Banking Crisis" since this engine has no bank-level
 * capital-depletion waterfall (spec §20) to distinguish the two
 * meaningfully. Stage 2 (Vulnerability Building) and Stage 3 (Market
 * Warning) are promoted (never demoted) by genuinely computed Hidden Risk
 * (§93: structural elevated, market still calm) and Market-Led Warning
 * (§94: market deteriorating well ahead of structural) flags — the same
 * "computed flag promotes a stage floor" pattern as G7 Debt. Stage 7
 * (Systemic Contagion) is reserved for the cross-country composite only,
 * promoted when a large share of ALL nine countries are simultaneously at
 * Stage 6+ (breadth-driven, same pattern as carryTrade.ts's Stage 7) — never
 * assigned to a single country in isolation.
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * the entire bank_master/bank-level layer (spec §7-9, 16-30, 46-58, 82-86,
 * 110-124), deposit/uninsured-deposit/deposit-velocity tracking (§23-26, no
 * free per-country source), CRE-refinancing-wall and mortgage-payment-shock
 * simulators (§40-42, need loan-maturity-schedule data no free source
 * publishes), sovereign-bank/property-bank/corporate-bank feedback-loop
 * SIMULATION (§72-76 — the underlying series exist and this engine notes the
 * conceptual linkage, but no forward simulation is run), an interactive
 * bank contagion network graph (§120-122), a full stress-scenario library
 * with deposit-outflow/wholesale-funding/collateral-haircut ladders (§22,
 * 107-109), historical backtesting with lead-time analysis (§145-148), and a
 * daily 8am banking report/AI Q&A layer (§125-134, 174).
 */

export type BankingRegimeLabel = "WELL_CAPITALIZED" | "STABLE" | "TIGHTENING" | "ASSET_QUALITY_STRESS" | "SYSTEMIC_BANK_STRESS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): BankingRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "WELL_CAPITALIZED";
  if (score < 40) return "STABLE";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "ASSET_QUALITY_STRESS";
  return "SYSTEMIC_BANK_STRESS";
}

export type BankingStageKey =
  | "HEALTHY"
  | "VULNERABILITY_BUILDING"
  | "MARKET_WARNING"
  | "FUNDING_LIQUIDITY_STRESS"
  | "CREDIT_DETERIORATION"
  | "BANKING_CRISIS"
  | "SYSTEMIC_CONTAGION";

export type BankingStageDef = {
  stage: number; // 1-7
  key: BankingStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const BANKING_STAGES: BankingStageDef[] = [
  { stage: 1, key: "HEALTHY", label: "Stage 1 — Healthy", shortLabel: "Healthy", description: "Capital, credit, funding, liquidity and market readings all sit within normal historical ranges." },
  { stage: 2, key: "VULNERABILITY_BUILDING", label: "Stage 2 — Vulnerability Building", shortLabel: "Vulnerability Building", description: "Structural fundamentals (capital/credit/funding/liquidity) deteriorating while market pricing hasn't reacted yet — genuinely computed, not asserted." },
  { stage: 3, key: "MARKET_WARNING", label: "Stage 3 — Market Warning", shortLabel: "Market Warning", description: "Bank-equity market pricing deteriorating well ahead of the underlying structural fundamentals." },
  { stage: 4, key: "FUNDING_LIQUIDITY_STRESS", label: "Stage 4 — Funding/Liquidity Stress", shortLabel: "Funding/Liquidity Stress", description: "Blended score has crossed into the range this model treats as genuine funding/liquidity tightening." },
  { stage: 5, key: "CREDIT_DETERIORATION", label: "Stage 5 — Credit Deterioration", shortLabel: "Credit Deterioration", description: "Severe, broad-based deterioration across structural and market readings together." },
  { stage: 6, key: "BANKING_CRISIS", label: "Stage 6 — Banking Crisis", shortLabel: "Banking Crisis", description: "Near the top of the observed stress range on this model's 0-100 scale. This app's convention folds spec's separate Capital-Stress stage in here — no bank-level capital-depletion data distinguishes the two." },
  { stage: 7, key: "SYSTEMIC_CONTAGION", label: "Stage 7 — Systemic Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL nine tracked countries are simultaneously at Stage 6 or worse — a breadth reading, never assigned to a single country in isolation." },
];

/** Fixed weights used both when computing Structural/Composite below and
 * when rendering the dashboard's per-country score breakdown (spec §110/135
 * "why is this score X" transparency ask) — exported so the breakdown UI
 * derives contributions from the same numbers the engine actually used,
 * rather than a second hard-coded copy that could drift out of sync. */
export const STRUCTURAL_WEIGHTS = { capital: 0.35, credit: 0.3, funding: 0.15, liquidity: 0.2 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, market: 0.35, contagion: 0.25 };

/** Leading Banking Stress Score weights — a re-derivation of already-computed
 * component scores using ONLY the subset this app's spec itself classifies
 * as LEADING rather than LAGGING (spec §186's own list: "LEADING: credit
 * growth, deposit outflows, funding spreads, CRE refinancing, bank equity,
 * yield curve" vs. "LAGGING: NPL, CET1 after losses, defaults"). Funding
 * (policy/interbank rate) and Market (bank equity price+vol) are used as-is
 * for every country; the Credit domain is used ONLY where it's the BIS
 * credit-to-GDP GAP (a genuine "credit boom excess" leading signal, UK/
 * Canada/Japan) — never where Credit is NPL-based, since NPL is explicitly
 * the spec's own lagging example. See the methodology page's own
 * "extrapolation" disclaimer before treating this as anything more than a
 * re-weighting of already-shown numbers. */
export const LEADING_WEIGHTS = { funding: 0.4, market: 0.35, creditGap: 0.25 };

function stageNumberFromScore(score: number): number {
  if (score < 15) return 1;
  if (score < 30) return 2;
  if (score < 45) return 3;
  if (score < 60) return 4;
  if (score < 75) return 5;
  if (score < 90) return 6;
  return 7;
}

export function bankingStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean): BankingStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  return BANKING_STAGES[Math.min(stage, 6) - 1]; // per-country rows cap at Stage 6; Stage 7 is composite-only, see getBankingCompositeScore
}

const CAPITAL_KEY = (key: string) => `banking.${key}.capital_to_assets_ratio`;
const NPL_KEY = (key: string) => `banking.${key}.npl_ratio`;

/** Per-country funding-cost proxy — the exact same series already wired in
 * for the Global Carry Trade engine (see carryTrade.ts/fred.ts), reused
 * rather than re-fetched. Japan is the one exception: carryTrade.ts still
 * uses the monthly OECD MEI proxy (rate.japan_interbank), but this table
 * uses BOJ's own daily uncollateralized O/N call rate (rate.japan_call_rate)
 * instead — already ingested for globalLiquidity.ts/treasuryRiskEngine.ts,
 * Tier 1, and same-day-of-publication rather than up to a month stale, so a
 * BOJ policy decision shows up here the next pipeline run instead of
 * potentially weeks later. See bojDecisionImpact.ts for the dedicated
 * decision/impact panel this also enables on the Banking page. */
const FUNDING_KEY: Record<string, string> = {
  us: "rate.fed_funds_effective",
  uk: "rate.uk_short_term",
  germany: "rate.ecb_deposit_facility",
  france: "rate.ecb_deposit_facility",
  italy: "rate.ecb_deposit_facility",
  japan: "rate.japan_call_rate",
  canada: "rate.canada_interbank",
  china: "rate.china_interbank_3m",
  india: "rate.india_interbank",
};
const FUNDING_FREQ: Record<string, "daily" | "monthly"> = {
  us: "daily", germany: "daily", france: "daily", italy: "daily", japan: "daily",
  uk: "monthly", canada: "monthly", china: "monthly", india: "monthly",
};

/** Per-country liquidity proxy — each country's own central-bank balance-
 * sheet/reserves series already flowing from globalLiquidity.ts/
 * liquidityRegime.ts. */
const LIQUIDITY_KEY: Record<string, string> = {
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
/** -1 everywhere except India: a DECLINING balance-sheet/reserve level means
 * tightening liquidity (risk up) for the other eight, but India's series is
 * RBI's own net liquidity INJECTION amount, where a RISING value means banks
 * needed more support (risk up) — see file-level comment. */
const LIQUIDITY_ZDIRECTION: Record<string, 1 | -1> = {
  us: -1, uk: -1, germany: -1, france: -1, italy: -1, japan: -1, canada: -1, china: -1, india: 1,
};
const LIQUIDITY_FREQ: Record<string, "daily" | "weekly" | "monthly"> = {
  us: "weekly", uk: "weekly", germany: "weekly", france: "weekly", italy: "weekly",
  japan: "monthly", canada: "weekly", china: "monthly", india: "daily",
};

const MARKET_KEY: Record<string, string> = {
  us: "banking.equity_us",
  uk: "banking.equity_uk",
  germany: "banking.equity_europe",
  france: "banking.equity_europe",
  italy: "banking.equity_europe",
  japan: "banking.equity_japan",
  canada: "banking.equity_canada",
  china: "banking.equity_china",
  india: "banking.equity_india",
};

/** UK/Canada/Japan's own BIS credit-to-GDP gap, already tracked in
 * creditRegime.ts — reused as a credit-boom-excess signal for those three. */
const CREDIT_GAP_KEY: Record<string, string> = {
  uk: "credit.uk_credit_gap",
  canada: "credit.canada_credit_gap",
  japan: "credit.japan_credit_gap",
};

function windowForFreq(freq: "daily" | "weekly" | "monthly" | "quarterly"): number {
  switch (freq) {
    case "daily":
    case "weekly":
      return 252;
    case "monthly":
      return 36;
    case "quarterly":
      return 12;
  }
}

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

export type BankingIndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

export type CountryBankingRow = {
  country: string;
  capitalRatio: BankingIndicatorReading;
  nplRatio: BankingIndicatorReading;
  fundingRate: BankingIndicatorReading;
  liquidityReading: BankingIndicatorReading;
  marketReading: BankingIndicatorReading;
  capitalScore: number | null;
  creditScore: number | null;
  fundingScore: number | null;
  liquidityScore: number | null;
  marketScore: number | null;
  structuralScore: number | null;
  contagionScore: number | null;
  compositeScore: number | null;
  regime: BankingRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
  creditGapScore: number | null;
  leadingScore: number | null;
  leadingCompleteness: number;
};

export async function getBankingSystemicRiskTable(db: SupabaseClient): Promise<CountryBankingRow[]> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceWeekly = new Date();
  sinceWeekly.setUTCDate(sinceWeekly.getUTCDate() - lookbackDaysFor("weekly"));
  const sinceMonthly = new Date();
  sinceMonthly.setUTCDate(sinceMonthly.getUTCDate() - lookbackDaysFor("monthly"));
  const sinceQuarterly = new Date();
  sinceQuarterly.setUTCDate(sinceQuarterly.getUTCDate() - lookbackDaysFor("quarterly"));
  const sinceFor = (freq: "daily" | "weekly" | "monthly" | "quarterly") =>
    (freq === "daily" ? sinceDaily : freq === "weekly" ? sinceWeekly : freq === "monthly" ? sinceMonthly : sinceQuarterly).toISOString();

  const fundingSeriesByCountry = new Map(
    await Promise.all(
      BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, FUNDING_KEY[c.key], sinceFor(FUNDING_FREQ[c.key]))] as const)
    )
  );
  const liquiditySeriesByCountry = new Map(
    await Promise.all(
      BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, LIQUIDITY_KEY[c.key], sinceFor(LIQUIDITY_FREQ[c.key]))] as const)
    )
  );
  const marketSeriesByCountry = new Map(
    await Promise.all(BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, MARKET_KEY[c.key], sinceDaily.toISOString())] as const))
  );
  const creditGapSeriesByCountry = new Map(
    await Promise.all(
      Object.entries(CREDIT_GAP_KEY).map(async ([key, metricKey]) => [key, await fetchSeries(db, metricKey, sinceQuarterly.toISOString())] as const)
    )
  );
  const [usDelinquency, usChargeoff, usCreDelinquency] = await Promise.all([
    fetchSeries(db, "banking.delinquency_rate_all_loans", sinceQuarterly.toISOString()),
    fetchSeries(db, "banking.chargeoff_rate_all_loans", sinceQuarterly.toISOString()),
    fetchSeries(db, "banking.cre_delinquency_rate", sinceQuarterly.toISOString()),
  ]);

  const latestKeys = [...BANKING_COUNTRIES.map((c) => CAPITAL_KEY(c.key)), ...BANKING_COUNTRIES.map((c) => NPL_KEY(c.key))];
  const latest = await fetchLatestForKeys(db, latestKeys);

  const capitalValues = new Map<string, number>();
  const nplValues = new Map<string, number>();
  for (const c of BANKING_COUNTRIES) {
    const cap = latest.get(CAPITAL_KEY(c.key));
    if (cap) capitalValues.set(c.key, cap.v);
    const npl = latest.get(NPL_KEY(c.key));
    if (npl) nplValues.set(c.key, npl.v);
  }
  const capitalZ = crossSectionalZ(capitalValues);
  const nplZ = crossSectionalZ(nplValues);

  // Pass 1: structural + market scores per country (contagion needs these
  // first, since it's a breadth measure over the whole tracked set).
  const prelim = BANKING_COUNTRIES.map((c) => {
    const capitalScore = capitalZ.has(c.key) ? zToRiskScore(capitalZ.get(c.key) ?? null, -1) : null;

    const nplScore = nplZ.has(c.key) ? zToRiskScore(nplZ.get(c.key) ?? null, 1) : null;
    const creditParts: { score: number; weight: number }[] = [];
    if (nplScore !== null) creditParts.push({ score: nplScore, weight: 1.0 });
    if (c.key === "us") {
      const delinquencyScore = zToRiskScore(zScore(usDelinquency, windowForFreq("quarterly")), 1);
      const chargeoffScore = zToRiskScore(zScore(usChargeoff, windowForFreq("quarterly")), 1);
      const creScore = zToRiskScore(zScore(usCreDelinquency, windowForFreq("quarterly")), 1);
      if (delinquencyScore !== null) creditParts.push({ score: delinquencyScore, weight: 0.5 });
      if (chargeoffScore !== null) creditParts.push({ score: chargeoffScore, weight: 0.4 });
      if (creScore !== null) creditParts.push({ score: creScore, weight: 0.6 });
    }
    let creditGapScore: number | null = null;
    if (CREDIT_GAP_KEY[c.key]) {
      const gapSeries = creditGapSeriesByCountry.get(c.key) ?? [];
      creditGapScore = zToRiskScore(zScore(gapSeries, windowForFreq("quarterly")), 1);
      if (creditGapScore !== null) creditParts.push({ score: creditGapScore, weight: 0.6 });
    }
    const creditScore =
      creditParts.length > 0 ? Math.round(creditParts.reduce((a, b) => a + b.score * b.weight, 0) / creditParts.reduce((a, b) => a + b.weight, 0)) : null;

    const fundingSeries = fundingSeriesByCountry.get(c.key) ?? [];
    const fundingScore = zToRiskScore(zScore(fundingSeries, windowForFreq(FUNDING_FREQ[c.key])), 1);

    const liquiditySeries = liquiditySeriesByCountry.get(c.key) ?? [];
    const liquidityScore = zToRiskScore(zScore(liquiditySeries, windowForFreq(LIQUIDITY_FREQ[c.key])), LIQUIDITY_ZDIRECTION[c.key]);

    const structParts = [
      capitalScore !== null ? { score: capitalScore, weight: STRUCTURAL_WEIGHTS.capital } : null,
      creditScore !== null ? { score: creditScore, weight: STRUCTURAL_WEIGHTS.credit } : null,
      fundingScore !== null ? { score: fundingScore, weight: STRUCTURAL_WEIGHTS.funding } : null,
      liquidityScore !== null ? { score: liquidityScore, weight: STRUCTURAL_WEIGHTS.liquidity } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const structuralScore =
      structParts.length > 0
        ? Math.round(structParts.reduce((a, b) => a + b.score * b.weight, 0) / structParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const marketSeries = marketSeriesByCountry.get(c.key) ?? [];
    const priceScore = zToRiskScore(zScore(marketSeries, windowForFreq("daily")), -1);
    const volScore = zToRiskScore(zScore(rollingRealizedVolSeries(marketSeries), windowForFreq("daily")), 1);
    const marketParts = [
      priceScore !== null ? { score: priceScore, weight: 0.6 } : null,
      volScore !== null ? { score: volScore, weight: 0.4 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const marketScore =
      marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b.score * b.weight, 0) / marketParts.reduce((a, b) => a + b.weight, 0)) : null;

    const prelimParts = [
      structuralScore !== null ? { score: structuralScore, weight: 0.55 } : null,
      marketScore !== null ? { score: marketScore, weight: 0.45 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const prelimScore =
      prelimParts.length > 0 ? prelimParts.reduce((a, b) => a + b.score * b.weight, 0) / prelimParts.reduce((a, b) => a + b.weight, 0) : null;

    return { c, capitalScore, creditScore, creditGapScore, fundingScore, liquidityScore, structuralScore, marketScore, prelimScore };
  });

  return prelim.map(({ c, capitalScore, creditScore, creditGapScore, fundingScore, liquidityScore, structuralScore, marketScore }) => {
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

    const capitalRow = latest.get(CAPITAL_KEY(c.key));
    const nplRow = latest.get(NPL_KEY(c.key));
    const fundingLast = latestPoint(fundingSeriesByCountry.get(c.key) ?? []);
    const liquidityLast = latestPoint(liquiditySeriesByCountry.get(c.key) ?? []);
    const marketLast = latestPoint(marketSeriesByCountry.get(c.key) ?? []);

    const applicableScores = [capitalScore, creditScore, fundingScore, liquidityScore, marketScore];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = bankingStageFor(compositeScore, hiddenRisk, marketLedWarning);

    const leadingParts = [
      fundingScore !== null ? { score: fundingScore, weight: LEADING_WEIGHTS.funding } : null,
      marketScore !== null ? { score: marketScore, weight: LEADING_WEIGHTS.market } : null,
      creditGapScore !== null ? { score: creditGapScore, weight: LEADING_WEIGHTS.creditGap } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const leadingScore =
      leadingParts.length > 0
        ? Math.round(leadingParts.reduce((a, b) => a + b.score * b.weight, 0) / leadingParts.reduce((a, b) => a + b.weight, 0))
        : null;
    const leadingApplicable = [fundingScore, marketScore, creditGapScore];
    const leadingCompleteness = Math.round((leadingApplicable.filter((v) => v !== null).length / leadingApplicable.length) * 100) / 100;

    return {
      country: c.name,
      capitalRatio: { value: capitalRow?.v ?? null, asOf: capitalRow?.t ?? null, score: capitalScore, previousValue: capitalRow?.previous?.v ?? null },
      nplRatio: { value: nplRow?.v ?? null, asOf: nplRow?.t ?? null, score: creditScore, previousValue: nplRow?.previous?.v ?? null },
      fundingRate: { value: fundingLast?.v ?? null, asOf: fundingLast?.t ?? null, score: fundingScore, previousValue: previousOf(fundingSeriesByCountry.get(c.key) ?? [])?.v ?? null },
      liquidityReading: { value: liquidityLast?.v ?? null, asOf: liquidityLast?.t ?? null, score: liquidityScore, previousValue: previousOf(liquiditySeriesByCountry.get(c.key) ?? [])?.v ?? null },
      marketReading: { value: marketLast?.v ?? null, asOf: marketLast?.t ?? null, score: marketScore, previousValue: previousOf(marketSeriesByCountry.get(c.key) ?? [])?.v ?? null },
      capitalScore,
      creditScore,
      fundingScore,
      liquidityScore,
      marketScore,
      structuralScore,
      contagionScore,
      compositeScore,
      regime: labelFromScore(compositeScore),
      hiddenRisk,
      marketLedWarning,
      dataCompleteness,
      stage: stageDef?.stage ?? null,
      stageLabel: stageDef?.shortLabel ?? "—",
      creditGapScore,
      leadingScore,
      leadingCompleteness,
    };
  });
}

/** Equal-weighted average of each country's Leading Banking Stress Score
 * (see LEADING_WEIGHTS above) — deliberately NOT run through the crisis-
 * stage machinery above, since "leading indicators are elevated" and "this
 * is Stage N" are different claims; see the methodology page's
 * extrapolation disclaimer before treating a high reading here as a
 * forecast. */
export function getLeadingCompositeScore(rows: CountryBankingRow[]): number | null {
  const withData = rows.filter((r) => r.leadingScore !== null);
  if (withData.length === 0) return null;
  return Math.round(withData.reduce((a, b) => a + (b.leadingScore as number), 0) / withData.length);
}

export function bankingBreadth(rows: CountryBankingRow[]): { stressedCount: number; totalWithData: number } {
  const stressedCount = rows.filter((r) => (r.compositeScore ?? 0) >= 60).length;
  const totalWithData = rows.filter((r) => r.compositeScore !== null).length;
  return { stressedCount, totalWithData };
}

/** Equal-weighted composite across the nine tracked countries, with the
 * composite stage promoted to 7 when a large share of ALL countries are
 * simultaneously at Stage 6+ — same breadth-driven promotion pattern as
 * carryTrade.ts's getCarryCompositeScore (see that file's own comment for
 * why this is applied only at the composite level, never to a single
 * country row). No GDP-weighting is applied (unlike G7 Debt) since GDP data
 * for China/India isn't in the same g7.*.gdp_current_usd keyspace this pass
 * — a disclosed simplification, not a data gap. */
export function getBankingCompositeScore(rows: CountryBankingRow[]): { score: number | null; stage: BankingStageDef | null } {
  const withData = rows.filter((r) => r.compositeScore !== null);
  if (withData.length === 0) return { score: null, stage: null };
  const score = Math.round(withData.reduce((a, b) => a + (b.compositeScore as number), 0) / withData.length);
  const { stressedCount, totalWithData } = bankingBreadth(rows);
  const crisisCount = rows.filter((r) => (r.stage ?? 0) >= 6).length;
  const breadthFrac = totalWithData > 0 ? crisisCount / totalWithData : 0;

  let stageNum = stageNumberFromScore(score);
  if (breadthFrac >= 0.5) stageNum = 7;
  else if (breadthFrac >= 0.25) stageNum = Math.max(stageNum, 6);
  else if (stressedCount > 0) stageNum = Math.max(stageNum, 4);

  return { score, stage: BANKING_STAGES[Math.min(stageNum, 7) - 1] };
}

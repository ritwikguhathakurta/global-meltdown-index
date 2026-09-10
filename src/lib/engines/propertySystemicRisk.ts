import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { BANKING_COUNTRIES } from "../sources/bankFinancialSoundness";

/**
 * Global Property Systemic Risk — built against a 256-section institutional
 * spec ("Global Property Systemic Risk Engine": residential + commercial +
 * construction + mortgage + developer + banking + macro contagion across a
 * property_country_master universe spanning G7+EM+ASEAN+CEE+LatAm+Middle
 * East+Africa, a bank/NBFI/developer contagion network, a 12-scenario
 * stress-test library, historical backtesting to the 1990s Japan property
 * collapse, a daily 8am report and AI Q&A layer...). Checked component by
 * component against what free, verified data genuinely supports for a
 * multi-country universe at once — the exact same discipline applied to
 * Carry Trade, G7/EM Debt and Banking Systemic Risk.
 *
 * This deliberately does NOT touch the existing "property" GFMI-weighted
 * engine (property.ts) or register a second GFMI vote — same "new
 * analytical layer, not a second count" pattern as bankingSystemicRisk.ts
 * (spec's own §216 "Double Counting Control" instruction). The existing
 * property.ts engine keeps its own eight-country real-HPI + US
 * mortgage-rate/starts/permits inputs unchanged.
 *
 * COUNTRY UNIVERSE: reuses BANKING_COUNTRIES verbatim (same nine countries,
 * same keys as the Banking engine — G7 plus China and India) rather than
 * spec's much larger G20+EM+ASEAN+CEE+LatAm+Middle East+Africa list (§6-7).
 * Deliberate: every one of these nine has genuinely verified, fresh, free
 * data for all three structural domains below; Australia, South Korea,
 * Singapore, Hong Kong, Brazil, Mexico, Indonesia, Turkiye, South Africa,
 * Saudi Arabia and UAE were not checked this pass — disclosed as deferred,
 * not attempted. Reusing the exact same country keys as Banking also makes
 * a genuine Property-Bank Convergence panel possible on the dashboard (spec
 * §141) by joining the two engines' tables on country key, no new mapping
 * needed.
 *
 * THREE DOMAINS feeding STRUCTURAL VULNERABILITY (spec §133's own 40%
 * valuation/25% leverage/15% affordability/10% supply/10% financing,
 * free-data-scoped down to three domains — "supply" and "financing" folded
 * into Affordability since no free source publishes cross-country housing
 * starts/permits or property-specific financing conditions outside the US):
 *
 *  - VALUATION: BIS "Selected residential property prices" real house price
 *    index — the same free FRED-mirrored series the existing property.ts
 *    engine already uses for 8 countries (US/Canada/UK/Germany/France/
 *    Italy/Japan/China), extended to India via a direct BIS SDMX fetch (no
 *    FRED mirror exists for India — see bisPropertyPrices.ts, verified live
 *    before use, fresh through 2026-Q1). Unlike Banking's cross-sectional
 *    capital ratio, valuation is scored as each country's OWN-HISTORY
 *    deviation from its long-run trend (a 60-quarter/15-year z-score window,
 *    not the app's usual 3-year window — spec's own §13 emphasis on 5Y/10Y/
 *    20Y trend windows, and comparing raw index LEVELS cross-sectionally
 *    would be meaningless since "elevated relative to its own history" is
 *    the actual valuation question, not "higher index number than country
 *    X"). A genuine price-to-income ratio (spec §17, OECD's own preferred
 *    affordability measure) was not found via a free, no-key, machine-
 *    readable API this pass — checked, not fabricated as a substitute.
 *  - CREDIT (leverage/credit-boom proxy): each country's own BIS
 *    credit-to-GDP gap — the exact same dataflow (WS_CREDIT_GAP) and
 *    genuine countercyclical-capital-buffer signal already used for three
 *    countries in bisCreditGap.ts, verified live this pass to also cover
 *    US/Germany/France/Italy/India (all fresh through 2025-Q4), giving this
 *    domain full nine-country coverage — a real total-credit gap, not a
 *    mortgage-specific one (no free source breaks mortgage credit out
 *    separately from total private credit across all nine countries), but
 *    still a genuine leading credit-boom-excess signal (spec's own §34,
 *    which explicitly says to connect valuation to the credit-to-GDP gap).
 *  - AFFORDABILITY: each country's own short-term policy/interbank rate —
 *    reusing the exact same series already wired in for Carry Trade and
 *    Banking's Funding domain, as a genuine (if imperfect) proxy for
 *    property-financing cost, since no free source publishes a
 *    cross-country 30-year-fixed-equivalent mortgage rate outside the US
 *    (property.mortgage_rate_30y, already tracked by property.ts, is
 *    US-only).
 *
 * MARKET STRESS: a REIT/property-sector equity index or ETF per country
 * (US Vanguard Real Estate ETF, UK/Europe/Canada/Japan/China REIT or
 * property ETFs, India's largest listed developer as a single-company
 * proxy where no live broad index was found — see yahooIndex.ts for
 * exactly which ticker and why). Blends the index level's own-history
 * z-score (60% — price below trend = stress) with realized-volatility
 * z-score (40%), the identical construction already used for Banking's
 * Market domain.
 *
 * CONTAGION: a breadth measure — the fraction of the OTHER eight countries
 * whose preliminary Structural+Market blend is already elevated (>= 60),
 * the same simplification already used for Banking/G7 Debt. Not yet a
 * genuine bank/NBFI/developer exposure-weighted network (spec §116, needs
 * bilateral exposure data no free source publishes) — a real
 * Property-Bank Convergence view (spec §141) is instead built directly on
 * the dashboard by joining this table with the Banking Systemic Risk
 * table on country key.
 *
 * STRUCTURAL = Valuation 40% + Credit 30% + Affordability 30%.
 * COMPOSITE = Structural 40% + Market 35% + Contagion 25% (spec §5's own
 * base weighting, applied verbatim).
 *
 * STAGE MODEL: spec's own STAGE 0-8 (§123, nine named stages) compressed to
 * this app's standard 7-stage convention, same compression pattern as
 * bankingSystemicRisk.ts. Hidden Property Risk (§124: structural elevated,
 * market still calm) and Market Already Warning (§202: market deteriorating
 * well ahead of structural) promote a country's stage floor, never demote —
 * identical mechanism to Banking's own Hidden Risk / Market-Led Warning
 * flags. Stage 7 (Systemic Contagion) is reserved for the cross-country
 * composite only, promoted on breadth, never assigned to a single country.
 *
 * LEADING PROPERTY STRESS SCORE: spec's own §137 leading/lagging
 * classification explicitly lists "valuation" and "credit growth" as
 * LEADING and "foreclosures/NPL/developer defaults" as LAGGING — so the
 * Leading score here is Valuation 50% + Credit 50%, deliberately excluding
 * Affordability (not spec-classified either way) and Market (spec's own
 * list puts "prices" — the property-market analogue of this domain — under
 * COINCIDENT, not leading, unlike Banking's spec which explicitly called
 * bank equity leading). See the methodology page's extrapolation
 * disclaimer before treating a high reading as a validated forecast.
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * the entire property_country_master/bank-level-equivalent granularity
 * (§7-8: residential segments, CRE by office/retail/industrial/hotel/
 * multifamily, developer balance sheets, REIT NAV/P-NAV, MBS spreads —
 * spec §62-91), affordability/price-to-income/price-to-rent/rental-yield
 * ratios (§16-19, no free cross-country API found), mortgage quality/LTV/
 * DSR/mortgage-reset-wall (§36-43, needs bank-level mortgage-book
 * disclosures no free source publishes), transaction/inventory/vacancy
 * tracking (§44-58, US-only free sources, not extended cross-country),
 * CRE cap-rate/DSCR/refinancing-wall engines (§20-22, 70-75, needs
 * property-level NOI/debt data), developer-specific engines (§76-82, needs
 * individual developer financials), a genuine bank/NBFI/developer
 * contagion network graph (§116), the full 12-scenario stress-test library
 * with UI controls (§205-207), historical backtesting with lead-time
 * analysis (§178-181), and a daily 8am report/AI Q&A layer (§208-212).
 */

export type PropertyRegimeLabel = "UNDERVALUED" | "FAIR_VALUE" | "ELEVATED" | "OVERHEATED" | "SYSTEMIC_STRESS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): PropertyRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "UNDERVALUED";
  if (score < 40) return "FAIR_VALUE";
  if (score < 60) return "ELEVATED";
  if (score < 80) return "OVERHEATED";
  return "SYSTEMIC_STRESS";
}

export type PropertyStageKey =
  | "HEALTHY"
  | "VALUATION_EXCESS"
  | "AFFORDABILITY_FINANCING_STRESS"
  | "MARKET_LIQUIDITY_STRESS"
  | "PRICE_CORRECTION"
  | "CREDIT_DEVELOPER_STRESS"
  | "SYSTEMIC_CONTAGION";

export type PropertyStageDef = {
  stage: number; // 1-7
  key: PropertyStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const PROPERTY_STAGES: PropertyStageDef[] = [
  { stage: 1, key: "HEALTHY", label: "Stage 1 — Healthy", shortLabel: "Healthy", description: "Valuation, credit and affordability readings all sit within normal historical ranges." },
  { stage: 2, key: "VALUATION_EXCESS", label: "Stage 2 — Valuation Excess", shortLabel: "Valuation Excess", description: "Structural fundamentals (valuation/credit/affordability) deteriorating while market pricing hasn't reacted yet — genuinely computed, not asserted. Folds spec's separate Stage 1 (credit/price acceleration) and Stage 2 (valuation excess) into one, since both are driven by the same Valuation+Credit domains here." },
  { stage: 3, key: "AFFORDABILITY_FINANCING_STRESS", label: "Stage 3 — Affordability / Financing Stress", shortLabel: "Affordability Stress", description: "Property-market equity/REIT pricing deteriorating well ahead of the underlying structural fundamentals." },
  { stage: 4, key: "MARKET_LIQUIDITY_STRESS", label: "Stage 4 — Market / Liquidity Stress", shortLabel: "Market Stress", description: "Blended score has crossed into the range this model treats as genuine market stress." },
  { stage: 5, key: "PRICE_CORRECTION", label: "Stage 5 — Price Correction", shortLabel: "Price Correction", description: "Severe, broad-based deterioration across structural and market readings together." },
  { stage: 6, key: "CREDIT_DEVELOPER_STRESS", label: "Stage 6 — Credit / Developer Stress", shortLabel: "Credit Stress", description: "Near the top of the observed stress range on this model's 0-100 scale. This app's convention folds spec's separate Credit/Developer Stress and Banking/NBFI Transmission stages in here — no developer-level or bank-exposure data distinguishes them meaningfully." },
  { stage: 7, key: "SYSTEMIC_CONTAGION", label: "Stage 7 — Systemic Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL nine tracked countries are simultaneously at Stage 6 or worse — a breadth reading, never assigned to a single country in isolation." },
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

export function propertyStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean): PropertyStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  return PROPERTY_STAGES[Math.min(stage, 6) - 1]; // per-country rows cap at Stage 6; Stage 7 is composite-only, see getPropertyCompositeScore
}

export const STRUCTURAL_WEIGHTS = { valuation: 0.4, credit: 0.3, affordability: 0.3 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, market: 0.35, contagion: 0.25 };
/** See file-level comment: Valuation and Credit are this engine's two
 * spec-classified LEADING inputs (§137); Affordability and Market are not
 * classified as leading there. */
export const LEADING_WEIGHTS = { valuation: 0.5, credit: 0.5 };

const VALUATION_KEY: Record<string, string> = {
  us: "property.hpi_real_us",
  japan: "property.hpi_real_japan",
  germany: "property.hpi_real_germany",
  france: "property.hpi_real_france",
  italy: "property.hpi_real_italy",
  uk: "property.hpi_real_uk",
  canada: "property.hpi_real_canada",
  china: "property.hpi_real_china",
  india: "property.hpi_real_india",
};
/** 60 quarters (15 years) — deliberately longer than this app's usual
 * 3-year window, since "elevated relative to its own long-run trend" (spec
 * §13-14) is a genuinely different, longer-horizon question than typical
 * short-window z-scores elsewhere in this app. */
const VALUATION_WINDOW_QUARTERS = 60;

const CREDIT_GAP_KEY: Record<string, string> = {
  us: "credit.us_credit_gap",
  japan: "credit.japan_credit_gap",
  germany: "credit.germany_credit_gap",
  france: "credit.france_credit_gap",
  italy: "credit.italy_credit_gap",
  uk: "credit.uk_credit_gap",
  canada: "credit.canada_credit_gap",
  china: "china.credit_impulse",
  india: "credit.india_credit_gap",
};
const CREDIT_GAP_WINDOW_QUARTERS = 12;

/** Per-country affordability/financing-cost proxy — reused verbatim from
 * carryTrade.ts/bankingSystemicRisk.ts's own FUNDING_KEY. */
const AFFORDABILITY_KEY: Record<string, string> = {
  us: "rate.fed_funds_effective",
  uk: "rate.uk_short_term",
  germany: "rate.ecb_deposit_facility",
  france: "rate.ecb_deposit_facility",
  italy: "rate.ecb_deposit_facility",
  japan: "rate.japan_interbank",
  canada: "rate.canada_interbank",
  china: "rate.china_interbank_3m",
  india: "rate.india_interbank",
};
const AFFORDABILITY_FREQ: Record<string, "daily" | "monthly"> = {
  us: "daily", germany: "daily", france: "daily", italy: "daily",
  uk: "monthly", japan: "monthly", canada: "monthly", china: "monthly", india: "monthly",
};

const MARKET_KEY: Record<string, string> = {
  us: "property.reit_us",
  uk: "property.reit_uk",
  germany: "property.reit_europe",
  france: "property.reit_europe",
  italy: "property.reit_europe",
  japan: "property.reit_japan",
  canada: "property.reit_canada",
  china: "property.reit_china",
  india: "property.reit_india",
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

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

export type PropertyIndicatorReading = { value: number | null; asOf: string | null; score: number | null };

export type CountryPropertyRow = {
  country: string;
  countryKey: string;
  valuationReading: PropertyIndicatorReading;
  creditReading: PropertyIndicatorReading;
  affordabilityReading: PropertyIndicatorReading;
  marketReading: PropertyIndicatorReading;
  valuationScore: number | null;
  creditScore: number | null;
  affordabilityScore: number | null;
  marketScore: number | null;
  structuralScore: number | null;
  contagionScore: number | null;
  compositeScore: number | null;
  regime: PropertyRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
  leadingScore: number | null;
};

export async function getPropertySystemicRiskTable(db: SupabaseClient): Promise<CountryPropertyRow[]> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceMonthly = new Date();
  sinceMonthly.setUTCDate(sinceMonthly.getUTCDate() - lookbackDaysFor("monthly"));
  // lookbackDaysFor("quarterly") is already ~25 years (100 quarters) —
  // comfortably more than VALUATION_WINDOW_QUARTERS (60) needs.
  const sinceQuarterlyLong = new Date();
  sinceQuarterlyLong.setUTCDate(sinceQuarterlyLong.getUTCDate() - lookbackDaysFor("quarterly"));
  const sinceQuarterlyShort = new Date();
  sinceQuarterlyShort.setUTCDate(sinceQuarterlyShort.getUTCDate() - lookbackDaysFor("quarterly"));
  const sinceFor = (freq: "daily" | "monthly") => (freq === "daily" ? sinceDaily : sinceMonthly).toISOString();

  const valuationSeriesByCountry = new Map(
    await Promise.all(BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, VALUATION_KEY[c.key], sinceQuarterlyLong.toISOString())] as const))
  );
  const creditGapSeriesByCountry = new Map(
    await Promise.all(BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, CREDIT_GAP_KEY[c.key], sinceQuarterlyShort.toISOString())] as const))
  );
  const affordabilitySeriesByCountry = new Map(
    await Promise.all(
      BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, AFFORDABILITY_KEY[c.key], sinceFor(AFFORDABILITY_FREQ[c.key]))] as const)
    )
  );
  const marketSeriesByCountry = new Map(
    await Promise.all(BANKING_COUNTRIES.map(async (c) => [c.key, await fetchSeries(db, MARKET_KEY[c.key], sinceDaily.toISOString())] as const))
  );

  // Pass 1: structural + market scores per country (contagion needs these
  // first, since it's a breadth measure over the whole tracked set).
  const prelim = BANKING_COUNTRIES.map((c) => {
    const valuationSeries = valuationSeriesByCountry.get(c.key) ?? [];
    const valuationZ = zScore(valuationSeries, VALUATION_WINDOW_QUARTERS);
    const valuationScore = zToRiskScore(valuationZ, 1); // above own long-run trend = higher risk

    const creditGapSeries = creditGapSeriesByCountry.get(c.key) ?? [];
    const creditScore = zToRiskScore(zScore(creditGapSeries, CREDIT_GAP_WINDOW_QUARTERS), 1);

    const affordabilitySeries = affordabilitySeriesByCountry.get(c.key) ?? [];
    const affordabilityScore = zToRiskScore(zScore(affordabilitySeries, windowForFreq(AFFORDABILITY_FREQ[c.key])), 1);

    const structParts = [
      valuationScore !== null ? { score: valuationScore, weight: STRUCTURAL_WEIGHTS.valuation } : null,
      creditScore !== null ? { score: creditScore, weight: STRUCTURAL_WEIGHTS.credit } : null,
      affordabilityScore !== null ? { score: affordabilityScore, weight: STRUCTURAL_WEIGHTS.affordability } : null,
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

    return { c, valuationScore, creditScore, affordabilityScore, marketScore, structuralScore, prelimScore };
  });

  return prelim.map(({ c, valuationScore, creditScore, affordabilityScore, marketScore, structuralScore }) => {
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

    const valuationLast = latestPoint(valuationSeriesByCountry.get(c.key) ?? []);
    const creditLast = latestPoint(creditGapSeriesByCountry.get(c.key) ?? []);
    const affordabilityLast = latestPoint(affordabilitySeriesByCountry.get(c.key) ?? []);
    const marketLast = latestPoint(marketSeriesByCountry.get(c.key) ?? []);

    const applicableScores = [valuationScore, creditScore, affordabilityScore, marketScore];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
    const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
    const stageDef = propertyStageFor(compositeScore, hiddenRisk, marketLedWarning);

    const leadingParts = [
      valuationScore !== null ? { score: valuationScore, weight: LEADING_WEIGHTS.valuation } : null,
      creditScore !== null ? { score: creditScore, weight: LEADING_WEIGHTS.credit } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const leadingScore =
      leadingParts.length > 0 ? Math.round(leadingParts.reduce((a, b) => a + b.score * b.weight, 0) / leadingParts.reduce((a, b) => a + b.weight, 0)) : null;

    return {
      country: c.name,
      countryKey: c.key,
      valuationReading: { value: valuationLast?.v ?? null, asOf: valuationLast?.t ?? null, score: valuationScore },
      creditReading: { value: creditLast?.v ?? null, asOf: creditLast?.t ?? null, score: creditScore },
      affordabilityReading: { value: affordabilityLast?.v ?? null, asOf: affordabilityLast?.t ?? null, score: affordabilityScore },
      marketReading: { value: marketLast?.v ?? null, asOf: marketLast?.t ?? null, score: marketScore },
      valuationScore,
      creditScore,
      affordabilityScore,
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
      leadingScore,
    };
  });
}

export function propertyBreadth(rows: CountryPropertyRow[]): { stressedCount: number; totalWithData: number } {
  const stressedCount = rows.filter((r) => (r.compositeScore ?? 0) >= 60).length;
  const totalWithData = rows.filter((r) => r.compositeScore !== null).length;
  return { stressedCount, totalWithData };
}

/** Equal-weighted composite across the nine tracked countries, with the
 * composite stage promoted to 7 when a large share of ALL countries are
 * simultaneously at Stage 6+ — same breadth-driven promotion pattern as
 * bankingSystemicRisk.ts's getBankingCompositeScore. */
export function getPropertyCompositeScore(rows: CountryPropertyRow[]): { score: number | null; stage: PropertyStageDef | null } {
  const withData = rows.filter((r) => r.compositeScore !== null);
  if (withData.length === 0) return { score: null, stage: null };
  const score = Math.round(withData.reduce((a, b) => a + (b.compositeScore as number), 0) / withData.length);
  const { stressedCount, totalWithData } = propertyBreadth(rows);
  const crisisCount = rows.filter((r) => (r.stage ?? 0) >= 6).length;
  const breadthFrac = totalWithData > 0 ? crisisCount / totalWithData : 0;

  let stageNum = stageNumberFromScore(score);
  if (breadthFrac >= 0.5) stageNum = 7;
  else if (breadthFrac >= 0.25) stageNum = Math.max(stageNum, 6);
  else if (stressedCount > 0) stageNum = Math.max(stageNum, 4);

  return { score, stage: PROPERTY_STAGES[Math.min(stageNum, 7) - 1] };
}

/** Equal-weighted average of each country's Leading Property Stress Score
 * (Valuation + Credit only, see LEADING_WEIGHTS). See the methodology
 * page's extrapolation disclaimer. */
export function getLeadingCompositeScore(rows: CountryPropertyRow[]): number | null {
  const withData = rows.filter((r) => r.leadingScore !== null);
  if (withData.length === 0) return null;
  return Math.round(withData.reduce((a, b) => a + (b.leadingScore as number), 0) / withData.length);
}

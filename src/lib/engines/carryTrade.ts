import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries, fetchLatestForKeys } from "../metrics/store";
import {
  zScore,
  zToRiskScore,
  percentileRank,
  realizedVolAnnualized,
  rollingRealizedVolSeries,
  ratioSeriesByDate,
  pctChangeOverDays,
  latest as latestPoint,
} from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import type { Point } from "../metrics/stats";

/**
 * Global Carry Trade Risk — built against a 97-section institutional spec
 * ("Global Carry Trade Systemic Risk Engine": FX/bond/EM/credit/vol/
 * commodity/crypto carry, forward-implied and covered-vs-uncovered carry,
 * options positioning/skew, cross-currency basis, a leverage engine, a
 * funding→FX→margin→liquidation→contagion network simulation, historical
 * backtesting to 1997, a daily 8am report and AI Q&A layer, a P&L
 * simulator...). Checked component by component against what free, verified
 * data genuinely supports for a broad funding/target-currency universe at
 * once — the same discipline applied to EM Debt and G7 Debt. What's built
 * here is the genuinely free-data-backed subset; everything else is
 * disclosed as deferred rather than faked — see the methodology page.
 *
 * This deliberately does NOT change the existing "yen_carry" GFMI-weighted
 * engine (yenCarry.ts) or register a second GFMI vote. This module is a new,
 * broader analytical layer reusing/extending the same kind of FX and rate
 * data, exposed on its own dashboard page — genuinely new analysis, not a
 * second count of the same JPY signal in the composite (spec's own §71/94
 * "avoid double counting" instruction).
 *
 * UNIVERSE: 4 funding currencies (JPY, CHF, EUR, USD — spec §2's explicit
 * list) x 17 target currencies (AUD, NZD, CAD, GBP, MXN, BRL, ZAR, INR, IDR,
 * TRY, PLN, HUF, CZK, KRW, CNY, THB, MYR, PHP). CLP/COP (spec §2) are not
 * covered — no free daily FX source was found for them (checked: ECB does
 * not publish a reference rate for either). Funding currencies are never
 * also treated as targets of each other here (e.g. a JPY-funded-EUR trade)
 * — a real, disclosed scoping simplification, not a data gap.
 *
 * CARRY RETURN (spec §3-4, uncovered/unhedged only — spec §5's forward-
 * implied/covered-interest-parity split needs live forward FX pricing, which
 * has no free source; disclosed as not built):
 *  - Rate differential: target country's short-term interbank/policy rate
 *    minus the funding currency's own (OECD MEI "Immediate Rates" series via
 *    FRED, or the closest live equivalent — see fred.ts for exactly which
 *    series and which countries/currencies have no free live series at all:
 *    New Zealand and China's own series are stale, Thailand/Malaysia/the
 *    Philippines have none, and Brazil's is a discount-rate proxy rather
 *    than the primary Selic policy rate, disclosed per-row as such).
 *  - FX return: the realized percentage return, in funding-currency terms,
 *    of holding the target currency — i.e. how much the target currency
 *    strengthened or weakened against the funding currency — from ECB/
 *    Frankfurter daily reference rates (see fx.ts), NOT the raw funding/
 *    target-per-USD levels swapped in without re-deriving the direction.
 *  - Realized Carry Return = rate differential + FX return, both annualized
 *    over a trailing ~1Y window. Roll/forward effects, hedging cost and
 *    transaction costs (spec §3-4) are not modeled — no free source for any
 *    of the three — so this is a real but incomplete uncovered-carry proxy,
 *    disclosed as such rather than presented as the full spec formula.
 *
 * VOLATILITY (spec §12-13): 20-day annualized realized volatility of the
 * funding/target cross rate, and — since a single vol reading in isolation
 * says nothing about whether it's unusually high or low for THIS pair — its
 * percentile within its own trailing ~1Y rolling-vol history, bucketed into
 * the spec's six vol-regime labels using that percentile (never a fixed
 * threshold shared across currencies, per spec §13's own instruction).
 *
 * POSITIONING (spec §16-17): CFTC Commitments of Traders net non-commercial
 * position (% of open interest), where a currency has an actively-reporting
 * CME futures contract (JPY, CHF, EUR, GBP, CAD, AUD, NZD, MXN, BRL, ZAR —
 * see cftcCot.ts for the exact currently-reporting contract name per
 * currency; several historical/renamed CFTC series for the same currency
 * were checked and rejected as stale). USD has no own-currency future and no
 * positioning proxy here; INR, IDR, TRY, PLN, HUF, CZK, KRW, CNY, THB, MYR
 * and PHP have no CFTC-reportable contract at all — genuinely unavailable,
 * not estimated. Crowding score is the percentile of how net-short the
 * funding currency currently is (blended with how net-long the target
 * currency is, when both are available) within each currency's own trailing
 * history — the spec's own "13-week/historical percentile" framing (§16),
 * not a fixed threshold.
 *
 * CARRY FRAGILITY (0-100, spec §31's own "carry trap" concept: carry
 * remains attractive while volatility is unusually low and positioning is
 * crowded): a weighted blend of crowding (35%), inverted volatility
 * percentile — i.e. LOW current vol relative to its own history raises this
 * score, since spec §12 explicitly frames compressed vol as the vulnerable
 * condition (35%), and the funding currency's own recent trend (30%,
 * appreciating funding currency = rising risk) — renormalized across
 * whichever of the three are available for that pair. This captures the
 * PRE-unwind "quiet buildup" phase; it deliberately does not fold in the
 * (very different, already-in-motion) unwind signal below into the same
 * number, since blending "still quiet" and "already reversing" into one
 * score would obscure exactly the distinction the spec's own stage model
 * needs to draw.
 *
 * CRISIS STAGE (spec §65's own "STAGE 0-6", renumbered 1-7 for this app's
 * convention — same as EM Debt/G7 Debt): stages 1-4 (Normal/Carry Building/
 * Crowding/Fragility) come directly from the Carry Fragility score's own
 * 15/30/45/60/75/90 bands. Stage 5 (Unwind Beginning) is a genuinely
 * detected condition, not a further fragility-score band: the funding
 * currency must already be meaningfully appreciating (z-score-derived
 * "funding reversal" score >= 65) AND realized volatility must already be
 * elevated (percentile >= 60) at the same time — spec §29's own "funding
 * currency reversal + volatility rises" combination. Stage 6 (Forced
 * Deleveraging) additionally requires the realized carry return to have
 * actually gone negative by more than the annual carry itself (i.e. the
 * position is now underwater, not just under pressure). Stage 7 (Systemic
 * Contagion) is reserved for the cross-pair composite reading only (see
 * getCarryCompositeScore) when a large share of ALL tracked pairs are
 * simultaneously at Stage 5+ — spec §57's own "carry unwind breadth"
 * concept — never assigned to a single pair in isolation, since one pair
 * unwinding alone is not "systemic" by any reasonable reading of that word.
 *
 * STILL NOT built — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * forward-implied/covered carry (needs live forward FX pricing), cross-
 * currency basis, FX options positioning/skew/risk-reversals, real
 * (inflation-adjusted) carry for every target country (would need a live
 * CPI series per target, not attempted this pass), leveraged-fund/dealer/
 * hedge-fund positioning beyond the CFTC non-commercial proxy, bond/credit/
 * volatility-selling/commodity/crypto carry as separately-modeled engines,
 * a funding→FX→margin→liquidation network simulation across banks/NBFIs/
 * hedge funds, historical backtesting against 1997-2026 carry episodes with
 * lead-time analysis, a daily report and AI Q&A layer, and a user-facing
 * P&L scenario simulator.
 */

export type FundingCurrencyDef = {
  key: string;
  name: string;
  code: string;
  /** Per-USD daily FX series key; null for USD itself (the numeraire). */
  fxKey: string | null;
  rateKey: string;
  rateLabel: string;
  cotKey: string | null;
};

export const FUNDING_CURRENCIES: FundingCurrencyDef[] = [
  { key: "jpy", name: "Japanese Yen", code: "JPY", fxKey: "fx.usdjpy", rateKey: "rate.japan_interbank", rateLabel: "Japan interbank rate (OECD MEI)", cotKey: "cot.jpy" },
  { key: "chf", name: "Swiss Franc", code: "CHF", fxKey: "fx.usdchf", rateKey: "rate.chf_interbank_3m", rateLabel: "Switzerland 3M interbank rate (OECD MEI)", cotKey: "cot.chf" },
  { key: "eur", name: "Euro", code: "EUR", fxKey: "fx.usdeur", rateKey: "rate.ecb_deposit_facility", rateLabel: "ECB deposit facility rate", cotKey: "cot.eur" },
  { key: "usd", name: "US Dollar", code: "USD", fxKey: null, rateKey: "rate.fed_funds_effective", rateLabel: "Fed funds effective rate", cotKey: null },
];

export type TargetCurrencyDef = {
  key: string;
  name: string;
  code: string;
  fxKey: string;
  rateKey: string | null;
  rateLabel?: string;
  rateCaveat?: string;
  cotKey: string | null;
};

export const TARGET_CURRENCIES: TargetCurrencyDef[] = [
  { key: "aud", name: "Australian Dollar", code: "AUD", fxKey: "fx.usdaud", rateKey: "rate.australia_interbank", rateLabel: "Australia interbank rate", cotKey: "cot.aud" },
  { key: "nzd", name: "New Zealand Dollar", code: "NZD", fxKey: "fx.usdnzd", rateKey: null, cotKey: "cot.nzd" },
  { key: "cad", name: "Canadian Dollar", code: "CAD", fxKey: "fx.usdcad", rateKey: "rate.canada_interbank", rateLabel: "Canada interbank rate", cotKey: "cot.cad" },
  { key: "gbp", name: "British Pound", code: "GBP", fxKey: "fx.usdgbp", rateKey: "rate.uk_short_term", rateLabel: "UK interbank rate", cotKey: "cot.gbp" },
  { key: "mxn", name: "Mexican Peso", code: "MXN", fxKey: "fx.usdmxn", rateKey: "rate.mexico_interbank", rateLabel: "Mexico interbank rate", cotKey: "cot.mxn" },
  {
    key: "brl", name: "Brazilian Real", code: "BRL", fxKey: "fx.usdbrl", rateKey: "rate.brazil_discount",
    rateLabel: "Brazil discount rate", rateCaveat: "Central bank discount rate — not the primary Selic policy rate; no free live Selic series was found.", cotKey: "cot.brl",
  },
  { key: "zar", name: "South African Rand", code: "ZAR", fxKey: "fx.usdzar", rateKey: "rate.south_africa_interbank", rateLabel: "South Africa interbank rate", cotKey: "cot.zar" },
  { key: "inr", name: "Indian Rupee", code: "INR", fxKey: "fx.usdinr", rateKey: "rate.india_interbank", rateLabel: "India interbank rate", cotKey: null },
  { key: "idr", name: "Indonesian Rupiah", code: "IDR", fxKey: "fx.usdidr", rateKey: "rate.indonesia_interbank", rateLabel: "Indonesia interbank rate", cotKey: null },
  { key: "try", name: "Turkish Lira", code: "TRY", fxKey: "fx.usdtry", rateKey: "rate.turkey_interbank", rateLabel: "Turkey interbank rate", cotKey: null },
  { key: "pln", name: "Polish Zloty", code: "PLN", fxKey: "fx.usdpln", rateKey: "rate.poland_interbank", rateLabel: "Poland interbank rate", cotKey: null },
  { key: "huf", name: "Hungarian Forint", code: "HUF", fxKey: "fx.usdhuf", rateKey: "rate.hungary_interbank", rateLabel: "Hungary interbank rate", cotKey: null },
  { key: "czk", name: "Czech Koruna", code: "CZK", fxKey: "fx.usdczk", rateKey: "rate.czech_interbank", rateLabel: "Czech interbank rate", cotKey: null },
  { key: "krw", name: "South Korean Won", code: "KRW", fxKey: "fx.usdkrw", rateKey: "rate.korea_interbank", rateLabel: "Korea interbank rate", cotKey: null },
  { key: "cny", name: "Chinese Yuan", code: "CNY", fxKey: "fx.usdcny", rateKey: null, cotKey: null },
  { key: "thb", name: "Thai Baht", code: "THB", fxKey: "fx.usdthb", rateKey: null, cotKey: null },
  { key: "myr", name: "Malaysian Ringgit", code: "MYR", fxKey: "fx.usdmyr", rateKey: null, cotKey: null },
  { key: "php", name: "Philippine Peso", code: "PHP", fxKey: "fx.usdphp", rateKey: null, cotKey: null },
];

export type VolRegime = "VERY_LOW" | "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "CRISIS";

function volRegimeFromPercentile(p: number | null): VolRegime | null {
  if (p === null) return null;
  if (p < 10) return "VERY_LOW";
  if (p < 30) return "LOW";
  if (p < 70) return "NORMAL";
  if (p < 90) return "ELEVATED";
  if (p < 97) return "HIGH";
  return "CRISIS";
}

export type CarryStageKey =
  | "NORMAL"
  | "CARRY_BUILDING"
  | "CROWDING"
  | "FRAGILITY"
  | "UNWIND_BEGINNING"
  | "FORCED_DELEVERAGING"
  | "SYSTEMIC_CONTAGION";

export type CarryStageDef = {
  stage: number; // 1-7
  key: CarryStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const CARRY_STAGES: CarryStageDef[] = [
  { stage: 1, key: "NORMAL", label: "Stage 1 — Normal", shortLabel: "Normal", description: "Carry, positioning and volatility all sit within normal historical ranges for this pair." },
  { stage: 2, key: "CARRY_BUILDING", label: "Stage 2 — Carry Building", shortLabel: "Carry Building", description: "Volatility is starting to compress and/or positioning is starting to build, but not yet extreme." },
  { stage: 3, key: "CROWDING", label: "Stage 3 — Crowding", shortLabel: "Crowding", description: "Positioning and/or unusually low volatility are now genuinely elevated relative to this pair's own history — a real, computed crowding reading." },
  { stage: 4, key: "FRAGILITY", label: "Stage 4 — Fragility", shortLabel: "Fragility", description: "Carry Fragility score has crossed into the range this model treats as a 'carry trap': attractive carry, crowded positioning, unusually calm volatility." },
  { stage: 5, key: "UNWIND_BEGINNING", label: "Stage 5 — Unwind Beginning", shortLabel: "Unwind Beginning", description: "The funding currency is already meaningfully appreciating AND realized volatility is already elevated at the same time — spec's own funding-reversal + volatility-rise combination, genuinely detected." },
  { stage: 6, key: "FORCED_DELEVERAGING", label: "Stage 6 — Forced Deleveraging", shortLabel: "Forced Deleveraging", description: "On top of Stage 5's conditions, the realized carry return has gone negative by more than the pair's own annual carry — the position is underwater, not just under pressure." },
  { stage: 7, key: "SYSTEMIC_CONTAGION", label: "Stage 7 — Systemic Contagion", shortLabel: "Systemic Contagion", description: "A large share of ALL tracked pairs are simultaneously at Stage 5 or worse — a breadth reading, never assigned to a single pair in isolation." },
];

function stageNumberFromFragility(score: number): number {
  if (score < 15) return 1;
  if (score < 30) return 2;
  if (score < 45) return 3;
  return 4; // fragility alone never implies an unwind is already underway
}

export type CarryPairRow = {
  fundingKey: string;
  fundingCode: string;
  fundingName: string;
  targetKey: string;
  targetCode: string;
  targetName: string;
  rateDifferential: number | null;
  rateAsOf: string | null;
  rateCaveat: string | null;
  fxReturn1y: number | null;
  realizedCarryReturn1y: number | null;
  realizedVol: number | null;
  volPercentile: number | null;
  volRegime: VolRegime | null;
  carryVolRatio: number | null;
  breakEvenMovePct: number | null;
  crowdingScore: number | null;
  fragilityScore: number | null;
  isCarryTrap: boolean;
  unwindFlag: boolean;
  severeUnwindFlag: boolean;
  stage: number | null;
  stageLabel: string;
  dataCompleteness: number;
};

export type FundingCurrencyRow = {
  key: string;
  code: string;
  name: string;
  rate: number | null;
  rateAsOf: string | null;
  rateLabel: string;
  fxTrend1yPct: number | null;
  fxTrendLabel: string;
  realizedVol: number | null;
  volPercentile: number | null;
  volRegime: VolRegime | null;
  netPositionPctOi: number | null;
  positionPercentile: number | null;
  fundingCostScore: number | null;
};

function crossSectionalZ(values: Map<string, number>): Map<string, number> {
  const z = new Map<string, number>();
  const arr = Array.from(values.values());
  if (arr.length < 3) return z;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const sd = Math.sqrt(variance);
  for (const [k, v] of values) z.set(k, sd > 0 ? (v - mean) / sd : 0);
  return z;
}

/** funding-per-target cross rate: rises when the target currency strengthens
 * against the funding currency (good for an investor long the target,
 * funded in the funding currency) — see the file-level comment for the
 * worked example that pins down this sign convention. */
function fundingPerTargetSeries(fundingSeries: Point[] | null, targetSeries: Point[]): Point[] {
  if (fundingSeries === null) {
    // Funding = USD: "funding per target" is just USD per target unit, the
    // inverse of the stored (target-per-USD) series.
    return targetSeries.map((p) => ({ t: p.t, v: p.v === 0 ? 0 : 1 / p.v }));
  }
  return ratioSeriesByDate(fundingSeries, targetSeries);
}

export async function getCarryTradeTable(db: SupabaseClient): Promise<{ pairs: CarryPairRow[]; funding: FundingCurrencyRow[] }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
  const sinceIso = since.toISOString();
  const cotSince = new Date();
  cotSince.setUTCDate(cotSince.getUTCDate() - lookbackDaysFor("weekly"));
  const cotSinceIso = cotSince.toISOString();

  const fundingFxKeys = FUNDING_CURRENCIES.map((f) => f.fxKey).filter((k): k is string => k !== null);
  const targetFxKeys = TARGET_CURRENCIES.map((t) => t.fxKey);
  const fxSeriesByKey = new Map(
    await Promise.all([...fundingFxKeys, ...targetFxKeys, "fx.dxy_broad"].map(async (k) => [k, await fetchSeries(db, k, sinceIso)] as const))
  );

  const cotKeys = [
    ...FUNDING_CURRENCIES.map((f) => f.cotKey).filter((k): k is string => k !== null),
    ...TARGET_CURRENCIES.map((t) => t.cotKey).filter((k): k is string => k !== null),
  ];
  const cotSeriesByKey = new Map(
    await Promise.all(cotKeys.map(async (k) => [k, await fetchSeries(db, `${k}.noncomm_net_pct_oi`, cotSinceIso)] as const))
  );

  const rateKeys = [...FUNDING_CURRENCIES.map((f) => f.rateKey), ...TARGET_CURRENCIES.map((t) => t.rateKey).filter((k): k is string => k !== null)];
  const rates = await fetchLatestForKeys(db, rateKeys);

  // Cross-sectional funding-cost score: lower rate among the 4 funding
  // currencies = more attractive to borrow = higher score.
  const fundingRateValues = new Map<string, number>();
  for (const f of FUNDING_CURRENCIES) {
    const r = rates.get(f.rateKey);
    if (r) fundingRateValues.set(f.key, r.v);
  }
  const fundingRateZ = crossSectionalZ(fundingRateValues);

  const fundingRows: FundingCurrencyRow[] = FUNDING_CURRENCIES.map((f) => {
    const rateRow = rates.get(f.rateKey);
    const ownSeries = f.fxKey ? fxSeriesByKey.get(f.fxKey) ?? [] : fxSeriesByKey.get("fx.dxy_broad") ?? [];
    const fxTrend1yPct = pctChangeOverDays(ownSeries, 365);
    const vol = realizedVolAnnualized(ownSeries);
    const volSeries = rollingRealizedVolSeries(ownSeries);
    const volPercentile = percentileRank(volSeries, 252);
    const cotSeries = f.cotKey ? cotSeriesByKey.get(f.cotKey) ?? [] : [];
    const netPositionPctOi = latestPoint(cotSeries)?.v ?? null;
    // How extremely NET-SHORT this currency is, relative to its own history
    // (negated so an extreme-short reading — the most negative raw values —
    // maps to a HIGH percentile, i.e. high crowding).
    const positionPercentile = cotSeries.length > 0 ? percentileRank(cotSeries.map((p) => ({ t: p.t, v: -p.v })), 260) : null;
    const fundingCostScore = fundingRateZ.has(f.key) ? zToRiskScore(fundingRateZ.get(f.key) ?? null, -1) : null;
    return {
      key: f.key,
      code: f.code,
      name: f.name,
      rate: rateRow?.v ?? null,
      rateAsOf: rateRow?.t ?? null,
      rateLabel: f.rateLabel,
      fxTrend1yPct,
      fxTrendLabel: f.fxKey ? `USD/${f.code} change (1Y)` : "DXY change (1Y)",
      realizedVol: vol,
      volPercentile,
      volRegime: volRegimeFromPercentile(volPercentile),
      netPositionPctOi,
      positionPercentile,
      fundingCostScore,
    };
  });

  const pairs: CarryPairRow[] = [];
  for (const f of FUNDING_CURRENCIES) {
    const fundingSeries = f.fxKey ? fxSeriesByKey.get(f.fxKey) ?? [] : null;
    const fundingRateRow = rates.get(f.rateKey);
    const fundingReversalSeries = f.fxKey ? fxSeriesByKey.get(f.fxKey) ?? [] : fxSeriesByKey.get("fx.dxy_broad") ?? [];
    // Direction: for JPY/CHF/EUR, a FALLING usdXXX value means that currency
    // is appreciating (risk up) -> zDirection -1. For USD, a RISING DXY
    // means USD is appreciating (risk up) -> zDirection +1.
    const fundingReversalScore = zToRiskScore(zScore(fundingReversalSeries, 60), f.fxKey ? -1 : 1);
    const fundingCotSeries = f.cotKey ? cotSeriesByKey.get(f.cotKey) ?? [] : [];
    const fundingCrowdingPercentile = fundingCotSeries.length > 0 ? percentileRank(fundingCotSeries.map((p) => ({ t: p.t, v: -p.v })), 260) : null;

    for (const t of TARGET_CURRENCIES) {
      const targetSeries = fxSeriesByKey.get(t.fxKey) ?? [];
      const crossSeries = fundingPerTargetSeries(fundingSeries, targetSeries);

      const targetRateRow = t.rateKey ? rates.get(t.rateKey) : undefined;
      const rateDifferential =
        targetRateRow && fundingRateRow ? Math.round((targetRateRow.v - fundingRateRow.v) * 100) / 100 : null;
      const rateAsOf = targetRateRow && fundingRateRow ? (targetRateRow.t < fundingRateRow.t ? targetRateRow.t : fundingRateRow.t) : null;

      const fxReturn1y = pctChangeOverDays(crossSeries, 365);
      const realizedCarryReturn1y = rateDifferential !== null && fxReturn1y !== null ? Math.round((rateDifferential + fxReturn1y) * 100) / 100 : null;

      const realizedVol = realizedVolAnnualized(crossSeries);
      const volSeries = rollingRealizedVolSeries(crossSeries);
      const volPercentile = percentileRank(volSeries, 252);
      const volRegime = volRegimeFromPercentile(volPercentile);

      const carryVolRatio = rateDifferential !== null && realizedVol !== null && realizedVol > 0 ? Math.round((rateDifferential / realizedVol) * 100) / 100 : null;
      const breakEvenMovePct = rateDifferential;

      const targetCotSeries = t.cotKey ? cotSeriesByKey.get(t.cotKey) ?? [] : [];
      const targetCrowdingPercentile = targetCotSeries.length > 0 ? percentileRank(targetCotSeries, 260) : null;
      const crowdingParts = [fundingCrowdingPercentile, targetCrowdingPercentile].filter((v): v is number => v !== null);
      const crowdingScore = crowdingParts.length > 0 ? Math.round(crowdingParts.reduce((a, b) => a + b, 0) / crowdingParts.length) : null;

      const fragilityParts = [
        crowdingScore !== null ? { score: crowdingScore, weight: 0.35 } : null,
        volPercentile !== null ? { score: 100 - volPercentile, weight: 0.35 } : null,
        fundingReversalScore !== null ? { score: fundingReversalScore, weight: 0.3 } : null,
      ].filter((p): p is { score: number; weight: number } => p !== null);
      const fragilityScore =
        fragilityParts.length > 0
          ? Math.round(fragilityParts.reduce((a, b) => a + b.score * b.weight, 0) / fragilityParts.reduce((a, b) => a + b.weight, 0))
          : null;

      const isCarryTrap =
        rateDifferential !== null && rateDifferential > 0 &&
        crowdingScore !== null && crowdingScore >= 70 &&
        volPercentile !== null && volPercentile <= 30 &&
        fundingReversalScore !== null && fundingReversalScore >= 40;

      const unwindFlag = fundingReversalScore !== null && fundingReversalScore >= 65 && volPercentile !== null && volPercentile >= 60;
      const severeUnwindFlag =
        unwindFlag &&
        fundingReversalScore !== null && fundingReversalScore >= 80 &&
        volPercentile !== null && volPercentile >= 85 &&
        realizedCarryReturn1y !== null && rateDifferential !== null && realizedCarryReturn1y < -Math.abs(rateDifferential);

      let stage: number | null = fragilityScore !== null ? stageNumberFromFragility(fragilityScore) : null;
      if (stage !== null) {
        if (unwindFlag) stage = Math.max(stage, 5);
        if (severeUnwindFlag) stage = Math.max(stage, 6);
      }
      const stageLabel = stage !== null ? CARRY_STAGES[stage - 1].shortLabel : "—";

      const completenessChecks = [rateDifferential !== null, fxReturn1y !== null, realizedVol !== null, crowdingScore !== null];
      const dataCompleteness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100) / 100;

      pairs.push({
        fundingKey: f.key,
        fundingCode: f.code,
        fundingName: f.name,
        targetKey: t.key,
        targetCode: t.code,
        targetName: t.name,
        rateDifferential,
        rateAsOf,
        rateCaveat: t.rateCaveat ?? null,
        fxReturn1y,
        realizedCarryReturn1y,
        realizedVol,
        volPercentile,
        volRegime,
        carryVolRatio,
        breakEvenMovePct,
        crowdingScore,
        fragilityScore,
        isCarryTrap,
        unwindFlag,
        severeUnwindFlag,
        stage,
        stageLabel,
        dataCompleteness,
      });
    }
  }

  return { pairs, funding: fundingRows };
}

export function carryBreadth(pairs: CarryPairRow[]): { unwindingCount: number; totalWithData: number } {
  const withData = pairs.filter((p) => p.fragilityScore !== null);
  const unwinding = withData.filter((p) => (p.stage ?? 0) >= 5);
  return { unwindingCount: unwinding.length, totalWithData: withData.length };
}

/** Equal-weighted average Carry Fragility across all pairs with data, with
 * the composite stage promoted to 6 or 7 when a large share of ALL pairs are
 * simultaneously at Stage 5+ — see the file-level comment for why this
 * breadth-driven promotion is applied only at the composite level, never to
 * an individual pair. */
export function getCarryCompositeScore(pairs: CarryPairRow[]): { score: number | null; stage: CarryStageDef | null } {
  const withData = pairs.filter((p) => p.fragilityScore !== null);
  if (withData.length === 0) return { score: null, stage: null };
  const score = Math.round(withData.reduce((a, b) => a + (b.fragilityScore as number), 0) / withData.length);
  const { unwindingCount, totalWithData } = carryBreadth(pairs);
  const breadthFrac = totalWithData > 0 ? unwindingCount / totalWithData : 0;

  let stageNum = stageNumberFromFragility(score);
  if (breadthFrac >= 0.5) stageNum = 7;
  else if (breadthFrac >= 0.25) stageNum = Math.max(stageNum, 6);
  else if (breadthFrac > 0) stageNum = Math.max(stageNum, 5);

  return { score, stage: CARRY_STAGES[stageNum - 1] };
}

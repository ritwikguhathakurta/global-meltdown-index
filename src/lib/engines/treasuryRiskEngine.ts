import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries, fetchLatestForKeys } from "../metrics/store";
import { zScore, zToRiskScore, previousOf, latest as latestPoint, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { G7_COUNTRIES } from "../sources/g7Fiscal";
import { EM_DEBT_COUNTRIES } from "../sources/worldBankEmDebt";
import { type FsrRegion, FSR_REGION_ORDER } from "../data/centralBankFsrRegistry";

/**
 * Global Treasury Risk Engine — built against a 259-section institutional
 * spec ("Global Treasury Risk Engine": sovereign cash management, funding/
 * issuance, rollover, auctions, interest-rate/FX portfolio risk, investor
 * base, contingent liabilities, sovereign ALM, market functioning, a
 * command-center frontend with 8 "signature features," historical
 * backtesting to 1992, a daily 8am AI report...). Checked component by
 * component against what free, verified data genuinely supports — the same
 * discipline already applied to Liquidity, Banking, Property, G7/EM Debt and
 * Carry Trade. This is the genuinely free-data-backed subset; everything
 * else is disclosed as deferred rather than faked (see the file-level "NOT
 * BUILT" list below and the methodology page).
 *
 * CORE DISTINCTION the spec itself insists on (§1) and this build honors:
 * this is NOT another sovereign-SOLVENCY score — g7DebtRegime.ts and
 * emDebtRegime.ts already answer "is this government's debt structurally
 * sustainable?". This engine answers a different question: "can the
 * Treasury actually fund and manage its obligations right now?" — cash
 * position, funding cost, market access, external/FX debt exposure. A
 * country can score fine here while its debt/GDP is elevated (funded
 * comfortably at long maturities, deep investor base), or score badly here
 * despite moderate debt (thin cash buffer, no dedicated data existing to
 * detect that, disclosed below).
 *
 * This deliberately does NOT touch the existing "us_treasury_sovereign"
 * GFMI-weighted engine (treasury.ts, the G7+China yield/debt-to-GDP blend
 * that already occupies the site's "Treasury" nav label/route) or
 * g7DebtRegime.ts's own UsTreasuryDetail sidecar — same "new analytical
 * layer, not a second GFMI vote" pattern as every other *SystemicRisk.ts /
 * *RiskEngine.ts module. Two of this file's three genuinely-new data
 * sources (US TGA cash balance, US debt-limit headroom — see
 * usTreasuryCash.ts) and one extension (5 more US auction tenors — see
 * usTreasuryDebt.ts's fetchUsAuctionStressExtended) were added specifically
 * for this engine; everything else below reuses metric keys that were
 * already live for other engines (G7 Debt's yields/debt-to-GDP/CDS, EM
 * Debt's external-debt/reserves/foreign-holdings, Liquidity's short-rate
 * map), verified present before being wired in here, not re-fetched.
 *
 * COUNTRY UNIVERSE: the union of G7_COUNTRIES (7) and EM_DEBT_COUNTRIES (14,
 * which already includes China and India) = 21 countries. Region field
 * reuses centralBankFsrRegistry.ts's FsrRegion/FSR_REGION_ORDER convention
 * for the same cross-table region grouping already used on the Banking/
 * Credit/Liquidity pages.
 *
 * FOUR DOMAINS (spec's own §3 lists ten; free data genuinely supports four
 * at country-table breadth, plus two US-only signature panels below):
 *
 *  - FUNDING COST: each country's own short-term policy/money-market rate
 *    (own-history z-score — a rising short rate is a rising Treasury-bill-
 *    equivalent funding cost, the closest free, uniform proxy across 18 of
 *    21 countries to spec's own §97 "Funding Cost" concept, since no free
 *    source publishes a cross-country new-issue-yield-vs-portfolio-coupon
 *    series). Reuses the exact same rate keys already live for
 *    liquiditySystemicRisk.ts's REPO_BASIS levels (kept as a separate map
 *    here since this domain scores the plain rate LEVEL, not a spread to
 *    policy — funding cost cares about the absolute rate a bill would clear
 *    at, not money-market/policy dislocation). Malaysia, Thailand and the
 *    Philippines have no free short-rate series found anywhere in this app
 *    (checked directly) — absent from this domain, not defaulted.
 *  - FX & EXTERNAL DEBT (14 EM only — G7 currencies aren't external-debt-
 *    service risks the same way): World Bank's external-debt/GNI,
 *    short-term-debt/reserves and reserves-months-of-imports (already live
 *    via worldBankEmDebt.ts for emDebtRegime.ts), cross-sectionally
 *    z-scored against EM peers only (never against G7, which has no
 *    comparable external-debt profile).
 *  - INVESTOR BASE: trend (own-history z-score, declining = risk up) of IMF
 *    foreign holdings of local-currency government debt (already live via
 *    imfForeignHoldings.ts for the same 14 EM countries) — a genuine, if
 *    partial, read of spec's §69 "Foreign Investor Share" concept. Not
 *    available for G7 (no equivalent free foreign-ownership-of-marketable-
 *    debt series found for all seven).
 *  - MARKET ACCESS: sovereign CDS (Damodaran/NYU Stern, already live for
 *    both G7 via g7Fiscal.ts and EM via worldBankEmDebt.ts's sibling
 *    sourcing), cross-sectionally z-scored WITHIN each peer group
 *    separately (G7-vs-G7, EM-vs-EM) — mixing the two would make every G7
 *    country read as trivially "safe" next to EM's much wider spreads,
 *    exactly the universal-threshold mistake this app's engines avoid
 *    elsewhere.
 *
 * STRUCTURAL = Funding Cost 30% + FX/External Debt 35% + Investor Base 35%
 * (EM: all three; G7: Funding Cost alone, renormalized — honest about that
 * imbalance rather than padding G7 with a fabricated external-debt score).
 * COMPOSITE = Structural 40% + Market Access 35% + Contagion 25%, the same
 * base weighting used everywhere else in this app (spec's own §5 also uses
 * this exact 40/35/25 split for its NORMAL regime; this build does not
 * implement the spec's adaptive NORMAL/STRESS/CRISIS regime-switching
 * weights — disclosed below, not attempted).
 *
 * TWO US-ONLY SIGNATURE PANELS (spec's own emphasis — §146 calls the US the
 * single most systemically important case, and its own architecture keeps
 * G7Debt's UsTreasuryDetail similarly separate from the per-country table):
 *  - getUsTreasuryCashPanel(): TGA (Treasury General Account) daily closing
 *    balance trend, and debt-limit headroom (Statutory Debt Limit minus
 *    debt actually subject to it) — both newly added this pass (see
 *    usTreasuryCash.ts). Per spec §147's own explicit instruction, this
 *    NEVER computes or displays an "X-date" exhaustion forecast — only the
 *    real, current headroom figure.
 *  - getUsAuctionHealthPanel(): bid-to-cover and indirect-bidder-share
 *    across 7 tenors (17W/26W/52W bills, 2Y/5Y/10Y/30Y notes+bonds) — the
 *    10Y/30Y pair already existed for g7DebtRegime.ts; the other five are
 *    new this pass (usTreasuryDebt.ts's fetchUsAuctionStressExtended).
 *
 * STAGE MODEL: spec's own STAGE 0–7 names (§155) mapped onto this app's
 * standard 1-7 convention (same 15/30/45/60/75/90 score bands, same
 * hiddenRisk/marketLedWarning promotion-only mechanism used by every other
 * *SystemicRisk.ts engine).
 *
 * STILL NOT BUILT — checked, no free/reliable source found or out of scope
 * for incremental work on an existing app, disclosed rather than faked:
 * cash-flow forecasting and forecast-error tracking (§15-21, needs a
 * government's own internal forecast, not published anywhere free),
 * non-US sovereign cash/TGA-equivalent balances (§149-154 ask for Japan/UK/
 * Germany/France/Italy/Canada cash management — no free daily source found
 * for any of the six), non-US auction results beyond what usTreasuryDebt.ts
 * already covers for the US (Japan MOF, UK DMO, Germany/France/Italy/Canada
 * checked directly, no stable free endpoint found), any debt-maturity-wall
 * breakdown by tenor bucket for any country (needs each debt office's own
 * portfolio composition data, not published in a free structured feed),
 * contingent liabilities / SOE / PPP / pension / natural-disaster exposure
 * (§102-124, needs each government's own balance-sheet disclosures — no
 * uniform free source across 21 countries), primary-dealer capacity/
 * inventories, sovereign wealth fund or non-reserve sovereign asset
 * tracking, the full stress-test scenario library and historical backtest
 * suite (§170, §210-214), the adaptive NORMAL/STRESS/CRISIS regime-weight
 * switching (§6, this build uses one fixed weighting), and the daily 8am
 * report / AI Q&A layer (§205-212).
 */

export type TreasuryRegimeLabel = "WELL_FUNDED" | "NORMAL" | "FUNDING_PRESSURE" | "MARKET_ACCESS_STRESS" | "SOVEREIGN_FUNDING_CRISIS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): TreasuryRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "WELL_FUNDED";
  if (score < 40) return "NORMAL";
  if (score < 60) return "FUNDING_PRESSURE";
  if (score < 80) return "MARKET_ACCESS_STRESS";
  return "SOVEREIGN_FUNDING_CRISIS";
}

export type TreasuryStageKey =
  | "NORMAL"
  | "FUNDING_PRESSURE"
  | "ROLLOVER_PRESSURE"
  | "AUCTION_DETERIORATION"
  | "MARKET_ACCESS_STRESS"
  | "TREASURY_LIQUIDITY_STRESS"
  | "SYSTEMIC_SOVEREIGN_EVENT";

export type TreasuryStageDef = { stage: number; key: TreasuryStageKey; label: string; shortLabel: string; description: string };

export const TREASURY_STAGES: TreasuryStageDef[] = [
  { stage: 1, key: "NORMAL", label: "Stage 1 — Normal", shortLabel: "Normal", description: "Funding cost, external-debt and market-access readings all sit within normal historical ranges." },
  { stage: 2, key: "FUNDING_PRESSURE", label: "Stage 2 — Funding Pressure", shortLabel: "Funding Pressure", description: "Structural funding-cost/external-debt/investor-base readings deteriorating while market pricing (CDS) hasn't reacted yet — genuinely computed, not asserted." },
  { stage: 3, key: "ROLLOVER_PRESSURE", label: "Stage 3 — Rollover Pressure", shortLabel: "Rollover Pressure", description: "Sovereign CDS/market-access pricing moving materially ahead of the underlying structural fundamentals." },
  { stage: 4, key: "AUCTION_DETERIORATION", label: "Stage 4 — Auction Deterioration", shortLabel: "Auction Deterioration", description: "Blended score has crossed into the range this model treats as genuine funding-condition tightening." },
  { stage: 5, key: "MARKET_ACCESS_STRESS", label: "Stage 5 — Market Access Stress", shortLabel: "Market Access Stress", description: "Severe, broad-based deterioration across structural and market-access readings together." },
  { stage: 6, key: "TREASURY_LIQUIDITY_STRESS", label: "Stage 6 — Treasury Liquidity Stress", shortLabel: "Liquidity Stress", description: "Near the top of the observed stress range on this model's 0-100 scale." },
  { stage: 7, key: "SYSTEMIC_SOVEREIGN_EVENT", label: "Stage 7 — Systemic Sovereign Event", shortLabel: "Systemic Event", description: "A large share of ALL 21 tracked Treasuries are simultaneously at Stage 6+ — a breadth reading, never assigned to a single country in isolation." },
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

export function treasuryStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean): TreasuryStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  return TREASURY_STAGES[Math.min(stage, 6) - 1]; // per-country rows cap at Stage 6; Stage 7 is composite-only
}

export const STRUCTURAL_WEIGHTS = { fundingCost: 0.3, externalDebt: 0.35, investorBase: 0.35 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, marketAccess: 0.35, contagion: 0.25 };

export type TreasuryCountry = { key: string; name: string; region: FsrRegion };

const G7_REGION: Record<string, FsrRegion> = {
  us: "G7", japan: "G7", germany: "G7", france: "G7", italy: "G7", uk: "G7", canada: "G7",
};
const EM_REGION: Record<string, FsrRegion> = {
  brazil: "Latin America", mexico: "Latin America",
  south_africa: "G20 / Major EM", turkey: "G20 / Major EM", india: "G20 / Major EM", china: "G20 / Major EM", south_korea: "G20 / Major EM",
  indonesia: "ASEAN", philippines: "ASEAN", thailand: "ASEAN", malaysia: "ASEAN",
  poland: "CEE", hungary: "CEE", czech_republic: "CEE",
};

export const TREASURY_COUNTRIES: TreasuryCountry[] = [
  ...G7_COUNTRIES.map((c) => ({ key: c.key, name: c.name, region: G7_REGION[c.key] ?? "G7" })),
  ...EM_DEBT_COUNTRIES.map((c) => ({ key: c.key, name: c.name, region: EM_REGION[c.key] ?? "G20 / Major EM" })),
];

export const TREASURY_REGION_ORDER = FSR_REGION_ORDER;

/** Own-history-scored short-term funding-cost proxy — the plain rate LEVEL
 * (not a spread to policy, see file-level comment). Malaysia/Thailand/
 * Philippines absent: no free short-rate series found anywhere in this app. */
const FUNDING_RATE_KEY: Record<string, string> = {
  us: "rate.sofr",
  uk: "rate.uk_sonia",
  germany: "rate.ecb_estr",
  france: "rate.ecb_estr",
  italy: "rate.ecb_estr",
  canada: "rate.canada_corra",
  japan: "rate.japan_call_rate",
  china: "china.interbank_rate_3m",
  india: "india.wacr",
  brazil: "rate.brazil_discount",
  mexico: "rate.mexico_interbank",
  indonesia: "rate.indonesia_interbank",
  south_korea: "rate.korea_interbank",
  south_africa: "rate.south_africa_interbank",
  turkey: "rate.turkey_interbank",
  poland: "rate.poland_interbank",
  czech_republic: "rate.czech_interbank",
  hungary: "rate.hungary_interbank",
};

const CDS_KEY: Record<string, string> = Object.fromEntries(
  TREASURY_COUNTRIES.map((c) => [c.key, G7_REGION[c.key] ? `g7.${c.key}.sovereign_cds_10y` : `emdebt.${c.key}.sovereign_cds_10y`])
);

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

export type TreasuryIndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

export type CountryTreasuryRow = {
  country: string;
  region: FsrRegion;
  fundingCost: TreasuryIndicatorReading;
  externalDebtToGni: TreasuryIndicatorReading;
  shortTermDebtToReserves: TreasuryIndicatorReading;
  reservesMonths: TreasuryIndicatorReading;
  foreignHoldings: TreasuryIndicatorReading;
  sovereignCds: TreasuryIndicatorReading;
  fundingCostScore: number | null;
  externalDebtScore: number | null;
  investorBaseScore: number | null;
  structuralScore: number | null;
  marketAccessScore: number | null;
  contagionScore: number | null;
  compositeScore: number | null;
  regime: TreasuryRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
};

export async function getTreasuryRiskTable(db: SupabaseClient): Promise<CountryTreasuryRow[]> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceAnnual = new Date();
  sinceAnnual.setUTCDate(sinceAnnual.getUTCDate() - lookbackDaysFor("annual"));

  const fundingSeriesByCountry = new Map(
    await Promise.all(
      TREASURY_COUNTRIES.map(async (c) => {
        const key = FUNDING_RATE_KEY[c.key];
        return [c.key, key ? await fetchSeries(db, key, sinceDaily.toISOString()) : []] as const;
      })
    )
  );

  const emKeys = EM_DEBT_COUNTRIES.map((c) => c.key);
  const structuralKeys = [
    ...emKeys.map((k) => `emdebt.${k}.external_debt_to_gni`),
    ...emKeys.map((k) => `emdebt.${k}.short_term_debt_to_reserves`),
    ...emKeys.map((k) => `emdebt.${k}.reserves_months_imports`),
    ...TREASURY_COUNTRIES.map((c) => CDS_KEY[c.key]),
  ];
  const latest = await fetchLatestForKeys(db, structuralKeys);

  const foreignHoldingsSeriesByCountry = new Map(
    await Promise.all(
      emKeys.map(async (k) => [k, await fetchSeries(db, `emdebt.${k}.foreign_holdings_debt_usd`, sinceAnnual.toISOString())] as const)
    )
  );

  const externalDebtValues = new Map<string, number>();
  const shortTermDebtValues = new Map<string, number>();
  const reservesMonthsValues = new Map<string, number>();
  for (const k of emKeys) {
    const ext = latest.get(`emdebt.${k}.external_debt_to_gni`);
    if (ext) externalDebtValues.set(k, ext.v);
    const st = latest.get(`emdebt.${k}.short_term_debt_to_reserves`);
    if (st) shortTermDebtValues.set(k, st.v);
    const rm = latest.get(`emdebt.${k}.reserves_months_imports`);
    if (rm) reservesMonthsValues.set(k, rm.v);
  }
  const externalDebtZ = crossSectionalZ(externalDebtValues);
  const shortTermDebtZ = crossSectionalZ(shortTermDebtValues);
  const reservesMonthsZ = crossSectionalZ(reservesMonthsValues);

  const g7CdsValues = new Map<string, number>();
  const emCdsValues = new Map<string, number>();
  for (const c of TREASURY_COUNTRIES) {
    const row = latest.get(CDS_KEY[c.key]);
    if (!row) continue;
    if (G7_REGION[c.key]) g7CdsValues.set(c.key, row.v);
    else emCdsValues.set(c.key, row.v);
  }
  const g7CdsZ = crossSectionalZ(g7CdsValues);
  const emCdsZ = crossSectionalZ(emCdsValues);

  // Pass 1: structural + market-access scores per country (contagion needs
  // these first, since it's a breadth measure over the whole tracked set).
  const prelim = TREASURY_COUNTRIES.map((c) => {
    const fundingSeries = fundingSeriesByCountry.get(c.key) ?? [];
    const fundingCostScore = fundingSeries.length > 0 ? zToRiskScore(zScore(fundingSeries, 252), 1) : null;

    const extZ = externalDebtZ.get(c.key);
    const externalDebtScore = extZ !== undefined ? zToRiskScore(extZ, 1) : null;
    const stZ = shortTermDebtZ.get(c.key);
    const rmZ = reservesMonthsZ.get(c.key);
    const extParts = [
      externalDebtScore !== null ? { score: externalDebtScore, weight: 0.4 } : null,
      stZ !== undefined ? { score: zToRiskScore(stZ, 1) as number, weight: 0.35 } : null,
      rmZ !== undefined ? { score: zToRiskScore(rmZ, -1) as number, weight: 0.25 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const externalCombinedScore =
      extParts.length > 0 ? Math.round(extParts.reduce((a, b) => a + b.score * b.weight, 0) / extParts.reduce((a, b) => a + b.weight, 0)) : null;

    const foreignHoldingsSeries = foreignHoldingsSeriesByCountry.get(c.key) ?? [];
    const investorBaseScore = foreignHoldingsSeries.length >= 3 ? zToRiskScore(zScore(foreignHoldingsSeries, 8), -1) : null;

    const structParts = [
      fundingCostScore !== null ? { score: fundingCostScore, weight: STRUCTURAL_WEIGHTS.fundingCost } : null,
      externalCombinedScore !== null ? { score: externalCombinedScore, weight: STRUCTURAL_WEIGHTS.externalDebt } : null,
      investorBaseScore !== null ? { score: investorBaseScore, weight: STRUCTURAL_WEIGHTS.investorBase } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const structuralScore =
      structParts.length > 0
        ? Math.round(structParts.reduce((a, b) => a + b.score * b.weight, 0) / structParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const cdsZv = G7_REGION[c.key] ? g7CdsZ.get(c.key) : emCdsZ.get(c.key);
    const marketAccessScore = cdsZv !== undefined ? zToRiskScore(cdsZv, 1) : null;

    const prelimParts = [
      structuralScore !== null ? { score: structuralScore, weight: 0.55 } : null,
      marketAccessScore !== null ? { score: marketAccessScore, weight: 0.45 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const prelimScore =
      prelimParts.length > 0 ? prelimParts.reduce((a, b) => a + b.score * b.weight, 0) / prelimParts.reduce((a, b) => a + b.weight, 0) : null;

    return { c, fundingCostScore, externalCombinedScore, investorBaseScore, structuralScore, marketAccessScore, prelimScore };
  });

  return prelim.map(({ c, fundingCostScore, externalCombinedScore, investorBaseScore, structuralScore, marketAccessScore }) => {
    const others = prelim.filter((p) => p.c.key !== c.key);
    const othersWithData = others.filter((p) => p.prelimScore !== null).length;
    const othersStressed = others.filter((p) => p.prelimScore !== null && (p.prelimScore as number) >= 60).length;
    const contagionScore = othersWithData >= 4 ? Math.round((othersStressed / othersWithData) * 100) : null;

    const compositeParts = [
      structuralScore !== null ? { score: structuralScore, weight: COMPOSITE_WEIGHTS.structural } : null,
      marketAccessScore !== null ? { score: marketAccessScore, weight: COMPOSITE_WEIGHTS.marketAccess } : null,
      contagionScore !== null ? { score: contagionScore, weight: COMPOSITE_WEIGHTS.contagion } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const compositeScore =
      compositeParts.length > 0
        ? Math.round(compositeParts.reduce((a, b) => a + b.score * b.weight, 0) / compositeParts.reduce((a, b) => a + b.weight, 0))
        : null;

    const fundingSeries = fundingSeriesByCountry.get(c.key) ?? [];
    const fundingLast = latestPoint(fundingSeries);
    const extRow = latest.get(`emdebt.${c.key}.external_debt_to_gni`);
    const stRow = latest.get(`emdebt.${c.key}.short_term_debt_to_reserves`);
    const rmRow = latest.get(`emdebt.${c.key}.reserves_months_imports`);
    const foreignHoldingsSeries = foreignHoldingsSeriesByCountry.get(c.key) ?? [];
    const foreignHoldingsLast = latestPoint(foreignHoldingsSeries);
    const cdsRow = latest.get(CDS_KEY[c.key]);

    const applicableScores = [fundingCostScore, externalCombinedScore, investorBaseScore, marketAccessScore];
    const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
    const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

    const hiddenRisk = structuralScore !== null && marketAccessScore !== null && structuralScore >= 55 && marketAccessScore < 40;
    const marketLedWarning = structuralScore !== null && marketAccessScore !== null && marketAccessScore >= 55 && marketAccessScore - structuralScore >= 20;
    const stageDef = treasuryStageFor(compositeScore, hiddenRisk, marketLedWarning);

    return {
      country: c.name,
      region: c.region,
      fundingCost: { value: fundingLast?.v ?? null, asOf: fundingLast?.t ?? null, score: fundingCostScore, previousValue: previousOf(fundingSeries)?.v ?? null },
      externalDebtToGni: { value: extRow?.v ?? null, asOf: extRow?.t ?? null, score: externalCombinedScore, previousValue: extRow?.previous?.v ?? null },
      shortTermDebtToReserves: { value: stRow?.v ?? null, asOf: stRow?.t ?? null, score: null, previousValue: stRow?.previous?.v ?? null },
      reservesMonths: { value: rmRow?.v ?? null, asOf: rmRow?.t ?? null, score: null, previousValue: rmRow?.previous?.v ?? null },
      foreignHoldings: { value: foreignHoldingsLast?.v ?? null, asOf: foreignHoldingsLast?.t ?? null, score: investorBaseScore, previousValue: previousOf(foreignHoldingsSeries)?.v ?? null },
      sovereignCds: { value: cdsRow?.v ?? null, asOf: cdsRow?.t ?? null, score: marketAccessScore, previousValue: cdsRow?.previous?.v ?? null },
      fundingCostScore,
      externalDebtScore: externalCombinedScore,
      investorBaseScore,
      structuralScore,
      marketAccessScore,
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

export function treasuryBreadth(rows: CountryTreasuryRow[]): { stressedCount: number; totalWithData: number } {
  const stressedCount = rows.filter((r) => (r.compositeScore ?? 0) >= 60).length;
  const totalWithData = rows.filter((r) => r.compositeScore !== null).length;
  return { stressedCount, totalWithData };
}

/** Equal-weighted composite across the 21 tracked Treasuries, with breadth-
 * driven Stage-7 promotion — same pattern as every other *SystemicRisk.ts
 * engine's getXCompositeScore. */
export function getTreasuryCompositeScore(rows: CountryTreasuryRow[]): { score: number | null; stage: TreasuryStageDef | null } {
  const withData = rows.filter((r) => r.compositeScore !== null);
  if (withData.length === 0) return { score: null, stage: null };
  const score = Math.round(withData.reduce((a, b) => a + (b.compositeScore as number), 0) / withData.length);
  const { stressedCount, totalWithData } = treasuryBreadth(rows);
  const crisisCount = rows.filter((r) => (r.stage ?? 0) >= 6).length;
  const breadthFrac = totalWithData > 0 ? crisisCount / totalWithData : 0;

  let stageNum = stageNumberFromScore(score);
  if (breadthFrac >= 0.5) stageNum = 7;
  else if (breadthFrac >= 0.25) stageNum = Math.max(stageNum, 6);
  else if (stressedCount > 0) stageNum = Math.max(stageNum, 4);

  return { score, stage: TREASURY_STAGES[Math.min(stageNum, 7) - 1] };
}

// ---------------------------------------------------------------------------
// US-only signature panels — genuinely distinct from the per-country table
// above, since no other country has a free daily cash-balance or debt-limit
// feed (see file-level comment).
// ---------------------------------------------------------------------------

export type UsTreasuryCashPanel = {
  tgaBalanceUsd: number | null;
  tgaBalancePreviousUsd: number | null;
  tgaAsOf: string | null;
  debtLimitHeadroomUsd: number | null;
  debtLimitHeadroomPreviousUsd: number | null;
  debtLimitAsOf: string | null;
};

export async function getUsTreasuryCashPanel(db: SupabaseClient): Promise<UsTreasuryCashPanel> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
  const [tgaSeries, headroomSeries] = await Promise.all([
    fetchSeries(db, "treasury.us_tga_balance_usd", since.toISOString()),
    fetchSeries(db, "treasury.us_debt_limit_headroom_usd", since.toISOString()),
  ]);
  const tgaLast = latestPoint(tgaSeries);
  const headroomLast = latestPoint(headroomSeries);
  return {
    tgaBalanceUsd: tgaLast?.v ?? null,
    tgaBalancePreviousUsd: previousOf(tgaSeries)?.v ?? null,
    tgaAsOf: tgaLast?.t ?? null,
    debtLimitHeadroomUsd: headroomLast?.v ?? null,
    debtLimitHeadroomPreviousUsd: previousOf(headroomSeries)?.v ?? null,
    debtLimitAsOf: headroomLast?.t ?? null,
  };
}

export type UsAuctionTenorReading = { tenorLabel: string; bidToCover: number | null; indirectPct: number | null; asOf: string | null };

const US_AUCTION_TENORS: { key: string; label: string }[] = [
  { key: "treasury.us_auction_17w", label: "17-Week Bill" },
  { key: "treasury.us_auction_26w", label: "26-Week Bill" },
  { key: "treasury.us_auction_52w", label: "52-Week Bill" },
  { key: "treasury.us_auction_2y", label: "2-Year Note" },
  { key: "treasury.us_auction_5y", label: "5-Year Note" },
  { key: "g7.us.auction_10y", label: "10-Year Note" },
  { key: "g7.us.auction_30y", label: "30-Year Bond" },
];

export async function getUsAuctionHealthPanel(db: SupabaseClient): Promise<UsAuctionTenorReading[]> {
  const keys = US_AUCTION_TENORS.flatMap((t) => [`${t.key}_bid_to_cover`, `${t.key}_indirect_pct`]);
  const latest = await fetchLatestForKeys(db, keys);
  return US_AUCTION_TENORS.map((t) => {
    const btc = latest.get(`${t.key}_bid_to_cover`);
    const indirect = latest.get(`${t.key}_indirect_pct`);
    return {
      tenorLabel: t.label,
      bidToCover: btc?.v ?? null,
      indirectPct: indirect?.v ?? null,
      asOf: btc?.t ?? indirect?.t ?? null,
    };
  });
}

export type { Point };

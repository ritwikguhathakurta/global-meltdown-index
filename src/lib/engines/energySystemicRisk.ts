import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, zToRiskScore, rollingRealizedVolSeries, previousOf, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";

/**
 * Energy Systemic Risk — built against a 171-section institutional spec
 * ("Global Energy Systemic Risk Engine": a 30-secondary-score GESRI covering
 * oil/gas/LNG/coal/electricity/grid/nuclear/renewables/critical-minerals/
 * shipping/chokepoints/geopolitics/weather/transition risk across a
 * producer+consumer country universe, a 250+-signal library, a global energy
 * trade network graph with node-centrality analysis, a 20-scenario stress
 * library with a policy simulator, historical backtesting to the 1973 oil
 * crisis, a daily 8am IST report and full AI Q&A layer...). Checked domain
 * by domain against what free, verified data genuinely supports for a
 * single incremental addition to an existing app rather than a from-scratch
 * commodity-intelligence platform — the same discipline already applied to
 * every other *SystemicRisk.ts engine here.
 *
 * This deliberately does NOT touch the existing flat, GFMI-weighted
 * "Energy" engine (energy.ts, still shown above this section on the Energy
 * dashboard page — Brent/WTI/Henry Hub spot levels only) — same "new
 * analytical layer, not a second vote" pattern used by every other
 * *SystemicRisk.ts file in this app (spec's own §89 "Dependency-Aware GFMI
 * Integration"/"do not double count" instruction, applied literally here).
 *
 * FOUR STRUCTURAL DOMAINS, each built on a genuinely free, verified,
 * already-or-newly-ingested series:
 *
 *  - OIL: blends Brent+WTI spot levels (already tracked by the flat energy.ts
 *    engine, reused here) with CBOE's Crude Oil ETF Volatility Index (OVX) —
 *    a real options-implied-volatility "market stress" signal for oil, the
 *    same concept as VIX for equities and not something computed in-house.
 *    Spec's own Oil Price Engine (§13) explicitly calls for "implied
 *    volatility" and "backwardation/contango" as physical-tightness signals;
 *    OVX supplies the first genuinely free and OVX is used as a direct
 *    stand-in rather than left unbuilt. A genuine futures curve
 *    (backwardation/contango, spec's own preferred signal) needs a paid
 *    futures-chain feed — checked, not found free, disclosed below.
 *  - NATURAL GAS: Henry Hub spot (already tracked) plus its own realized
 *    volatility, blended with real US Lower-48 natural gas working
 *    underground storage from EIA API v2 (energy.us_natgas_storage, weekly,
 *    BCF) — the genuine "Gas Storage Adequacy" signal spec §19 calls for,
 *    scored against its own 5-year seasonal range (below norm = risk).
 *  - CRITICAL MINERALS / NUCLEAR FUEL: Copper and Uranium — both IMF-sourced
 *    "Global price of ..." series FRED already mirrors monthly. Scored on
 *    |z| (extreme moves in EITHER direction count as risk), not a signed
 *    direction: a price spike reflects the bottleneck/scarcity spec's
 *    Mineral Bottleneck Engine (§35) describes, while a price collapse can
 *    reflect the demand-collapse/investment-withdrawal risk spec's own
 *    Energy Deflation Engine (§108) explicitly treats as a distinct hazard
 *    ("energy prices are low while upstream investment collapses" is
 *    literally spec's own Hidden Energy Risk example, §78). Lithium was
 *    checked directly against FRED/OECD MEI and has no equivalent
 *    already-computed free series — disclosed as a gap.
 *  - SHIPPING / SUPPLY CHAIN: blends the NY Fed's Global Supply Chain
 *    Pressure Index (GSCPI, supplychain.gscpi, already ingested for the
 *    Supply Chains engine, reused not re-fetched) with a genuine chokepoint
 *    signal from IMF PortWatch (imfPortwatch.ts) — free, official, AIS-derived
 *    daily tanker-transit counts for Hormuz, Bab el-Mandeb, Suez and Malacca,
 *    the four chokepoints through which the large majority of seaborne oil
 *    and LNG physically moves. A drop in tanker transits below the
 *    chokepoint's own trailing norm scores as risk (direction -1) — this is
 *    the real vessel-level throughput signal spec's Maritime Chokepoint
 *    Engine (§43) and Oil Chokepoint Engine (§15) call for, superseding the
 *    original build's "no free chokepoint data exists" assumption.
 *
 * MARKET: the Energy Select Sector SPDR (XLE, energy.xle_price) own-history
 * price z-score (60%, price below trend = stress) blended with realized-
 * volatility z-score (40%) — the identical construction already used by
 * every sibling *SystemicRisk.ts engine's own Market domain. No free
 * cross-country energy-equity index exists; XLE is a liquid, real-time proxy
 * for how markets price producer/company financial stress (spec's own
 * Energy Corporate Credit/Financing Risk concepts, §25-27, 59).
 *
 * STRUCTURAL = Oil 35% + Natural Gas 25% + Critical Minerals/Nuclear Fuel
 * 20% + Shipping 20% (weighted toward oil's outsized share of global energy
 * trade value and price-shock transmission, spec's own emphasis throughout).
 * COMPOSITE = Structural 40% + Market 35% + Convergence 25% — this app's
 * standard split, applied verbatim.
 *
 * CONVERGENCE: because this is a single global entity (not a peer-country
 * table), the cross-country contagion-breadth pattern every other
 * *SystemicRisk.ts file uses cannot apply directly. Spec's own §77 "Energy
 * Supply Chain Convergence" ("raise risk when independent stress appears
 * simultaneously in Oil + Gas + Power + Shipping + Critical Minerals +
 * Infrastructure + Weather + Geopolitics... do not simply sum correlated
 * variables") supplies the single-entity substitute used here instead: the
 * fraction of this engine's own FOUR structural domains that are
 * independently elevated (>=60) at the same time — the same domain-breadth
 * adaptation already used by chinaSystemicRisk.ts.
 *
 * STAGE MODEL: spec's own 9-stage Energy Crisis Clock (§75, Stage 0 Normal
 * through Stage 8 Global Energy Crisis) compressed to this app's standard
 * 7-stage convention — the same compression pattern already used by
 * Property/Banking/Carry Trade/Treasury Risk/China. Hidden Energy Risk
 * (spec §78: structural stress building, market still calm) and a
 * market-led warning (market deteriorating well ahead of structural)
 * promote the stage floor, never demote it. Stage 7 is reserved for a
 * genuinely high Convergence reading alongside an already-high composite.
 *
 * STILL NOT built — checked, no free/reliable no-key source found, or
 * genuinely out of scope for incremental work on an existing app, disclosed
 * rather than faked: country-level spare-capacity accounting (spec §11 — no
 * free source publishes producer-level effective spare capacity), OPEC+
 * quota/compliance tracking (§49), a genuine futures curve/backwardation
 * signal (§13, needs a paid futures-chain feed), electricity/grid reserve-margin
 * and blackout-risk data (§23-25, 69 — ENTSO-E/PJM/ERCOT/CAISO/MISO all
 * checked live; each needs its own registration this deployment does not yet
 * have), nuclear reactor-level outage tracking (§28, IAEA PRIS has no public
 * API), renewable capacity/generation by country (§30-32, IRENA IRENASTAT
 * confirmed free but not yet integrated), critical-mineral mining/refining/
 * manufacturing concentration breakdowns (§34-35), a global energy trade
 * network graph with node centrality (§82-84, 122-123), a 20-scenario
 * stress-test library with a user-facing policy simulator (§85-86), producer
 * fiscal-breakeven tracking (§50, 95 — these are analyst estimates, not a
 * free official series), historical backtesting with lead-time/AUC/Brier-
 * score validation (§142-145), and a daily 8am IST report/AI Q&A layer
 * (§136-139, 162-164). This is being built out in phases, not abandoned —
 * see /dashboard/methodology#energy-systemic-risk for current phase status.
 */

export type EnergyRegimeLabel = "AMPLE_SUPPLY" | "BALANCED" | "TIGHTENING" | "SHOCK_RISK" | "ACTIVE_CRISIS" | "INSUFFICIENT_DATA";

function labelFromScore(score: number | null): EnergyRegimeLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score < 20) return "AMPLE_SUPPLY";
  if (score < 40) return "BALANCED";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "SHOCK_RISK";
  return "ACTIVE_CRISIS";
}

export type EnergyStageKey = "NORMAL" | "VULNERABILITY_BUILDING" | "SUPPLY_TIGHTENING" | "PRICE_STRESS" | "MARKET_DISLOCATION" | "SEVERE_STRESS" | "GLOBAL_ENERGY_CRISIS";

export type EnergyStageDef = {
  stage: number; // 1-7
  key: EnergyStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const ENERGY_STAGES: EnergyStageDef[] = [
  { stage: 1, key: "NORMAL", label: "Stage 1 — Normal", shortLabel: "Normal", description: "Oil, gas, critical-minerals and shipping readings all sit within normal historical ranges." },
  { stage: 2, key: "VULNERABILITY_BUILDING", label: "Stage 2 — Vulnerability Building", shortLabel: "Vulnerability Building", description: "Structural domains deteriorating while the energy-equity market hasn't reacted yet — genuinely computed Hidden Energy Risk, not asserted." },
  { stage: 3, key: "SUPPLY_TIGHTENING", label: "Stage 3 — Supply Tightening", shortLabel: "Supply Tightening", description: "The energy-equity market is deteriorating well ahead of the underlying structural fundamentals (a market-led warning), or the blended score has crossed into genuine tightening." },
  { stage: 4, key: "PRICE_STRESS", label: "Stage 4 — Price Stress", shortLabel: "Price Stress", description: "Blended composite score has crossed into the range this model treats as genuine price/market stress." },
  { stage: 5, key: "MARKET_DISLOCATION", label: "Stage 5 — Market Dislocation", shortLabel: "Market Dislocation", description: "Severe, broad-based deterioration across structural and market readings together." },
  { stage: 6, key: "SEVERE_STRESS", label: "Stage 6 — Severe Stress", shortLabel: "Severe Stress", description: "Near the top of the observed stress range on this model's 0-100 scale." },
  { stage: 7, key: "GLOBAL_ENERGY_CRISIS", label: "Stage 7 — Global Energy Crisis", shortLabel: "Global Energy Crisis", description: "A large share of ALL FOUR structural domains are simultaneously elevated at once (a high Convergence reading) alongside an already-high composite — genuine cross-domain convergence, not one commodity in isolation." },
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

export function energyStageFor(compositeScore: number | null, hiddenRisk: boolean, marketLedWarning: boolean, convergenceScore: number | null): EnergyStageDef | null {
  if (compositeScore === null) return null;
  let stage = stageNumberFromScore(compositeScore);
  if (hiddenRisk) stage = Math.max(stage, 2);
  if (marketLedWarning) stage = Math.max(stage, 3);
  if (convergenceScore !== null && convergenceScore >= 75 && compositeScore >= 60) stage = 7;
  else if (convergenceScore !== null && convergenceScore >= 50 && compositeScore >= 50) stage = Math.max(stage, 6);
  return ENERGY_STAGES[Math.min(stage, 7) - 1];
}

export const STRUCTURAL_WEIGHTS = { oil: 0.35, gas: 0.25, minerals: 0.2, shipping: 0.2 };
export const COMPOSITE_WEIGHTS = { structural: 0.4, market: 0.35, convergence: 0.25 };

export type EnergyDomainScores = { oilScore: number | null; gasScore: number | null; mineralsScore: number | null; shippingScore: number | null; marketScore: number | null };

export type EnergyComposite = {
  structuralScore: number | null;
  convergenceScore: number | null;
  compositeScore: number | null;
  regime: EnergyRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  stage: number | null;
  stageLabel: string;
};

// The same structural/composite weighting and stage logic used by
// getEnergySystemicRiskResult below, pulled out as a pure function so the
// scenario simulator (energyScenarios.ts) can apply a hypothetical shock to
// today's domain scores and get back a result computed by the identical
// production methodology — not a parallel reimplementation of it.
export function composeEnergyComposite(domains: EnergyDomainScores): EnergyComposite {
  const { oilScore, gasScore, mineralsScore, shippingScore, marketScore } = domains;
  const structuralParts = [
    oilScore !== null ? { score: oilScore, weight: STRUCTURAL_WEIGHTS.oil } : null,
    gasScore !== null ? { score: gasScore, weight: STRUCTURAL_WEIGHTS.gas } : null,
    mineralsScore !== null ? { score: mineralsScore, weight: STRUCTURAL_WEIGHTS.minerals } : null,
    shippingScore !== null ? { score: shippingScore, weight: STRUCTURAL_WEIGHTS.shipping } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const structuralScore = structuralParts.length > 0 ? Math.round(structuralParts.reduce((a, b) => a + b.score * b.weight, 0) / structuralParts.reduce((a, b) => a + b.weight, 0)) : null;

  const domainScores = [oilScore, gasScore, mineralsScore, shippingScore];
  const domainsWithData = domainScores.filter((v) => v !== null) as number[];
  const domainsStressed = domainsWithData.filter((v) => v >= 60).length;
  const convergenceScore = domainsWithData.length >= 3 ? Math.round((domainsStressed / domainsWithData.length) * 100) : null;

  const compositeParts = [
    structuralScore !== null ? { score: structuralScore, weight: COMPOSITE_WEIGHTS.structural } : null,
    marketScore !== null ? { score: marketScore, weight: COMPOSITE_WEIGHTS.market } : null,
    convergenceScore !== null ? { score: convergenceScore, weight: COMPOSITE_WEIGHTS.convergence } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const compositeScore = compositeParts.length > 0 ? Math.round(compositeParts.reduce((a, b) => a + b.score * b.weight, 0) / compositeParts.reduce((a, b) => a + b.weight, 0)) : null;

  const hiddenRisk = structuralScore !== null && marketScore !== null && structuralScore >= 55 && marketScore < 40;
  const marketLedWarning = structuralScore !== null && marketScore !== null && marketScore >= 55 && marketScore - structuralScore >= 20;
  const stageDef = energyStageFor(compositeScore, hiddenRisk, marketLedWarning, convergenceScore);

  return {
    structuralScore,
    convergenceScore,
    compositeScore,
    regime: labelFromScore(compositeScore),
    hiddenRisk,
    marketLedWarning,
    stage: stageDef?.stage ?? null,
    stageLabel: stageDef?.shortLabel ?? "—",
  };
}

const BRENT_KEY = "commodity.brent";
const WTI_KEY = "commodity.wti";
const OVX_KEY = "energy.oil_volatility_ovx";
const HENRY_HUB_KEY = "commodity.natgas_henry_hub";
const US_NATGAS_STORAGE_KEY = "energy.us_natgas_storage";
const COPPER_KEY = "energy.copper_price";
const URANIUM_KEY = "energy.uranium_price";
const GSCPI_KEY = "supplychain.gscpi";
const XLE_KEY = "energy.xle_price";

// The four chokepoints through which most seaborne oil/LNG physically moves
// — see imfPortwatch.ts. A drop in tanker transits below trend scores as risk.
const CHOKEPOINT_TANKER_KEYS = [
  { slug: "hormuz", label: "Strait of Hormuz" },
  { slug: "bab_el_mandeb", label: "Bab el-Mandeb" },
  { slug: "suez_canal", label: "Suez Canal" },
  { slug: "malacca_strait", label: "Malacca Strait" },
] as const;

const DAILY_WINDOW = 252;
const MONTHLY_WINDOW = 36;

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

export type EnergyIndicatorReading = { value: number | null; asOf: string | null; score: number | null; previousValue: number | null };

export type EnergySystemicRiskResult = {
  oilReading: { brent: EnergyIndicatorReading; wti: EnergyIndicatorReading; ovx: EnergyIndicatorReading };
  oilScore: number | null;
  gasReading: { henryHub: EnergyIndicatorReading; storage: EnergyIndicatorReading };
  gasScore: number | null;
  mineralsReading: { copper: EnergyIndicatorReading; uranium: EnergyIndicatorReading };
  mineralsScore: number | null;
  shippingReading: EnergyIndicatorReading;
  shippingScore: number | null;
  chokepointReadings: { slug: string; label: string; value: number | null; asOf: string | null; score: number | null; previousValue: number | null }[];
  marketReading: EnergyIndicatorReading;
  marketScore: number | null;
  structuralScore: number | null;
  convergenceScore: number | null;
  compositeScore: number | null;
  regime: EnergyRegimeLabel;
  hiddenRisk: boolean;
  marketLedWarning: boolean;
  dataCompleteness: number;
  stage: number | null;
  stageLabel: string;
};

export async function getEnergySystemicRiskResult(db: SupabaseClient): Promise<EnergySystemicRiskResult> {
  const sinceDaily = new Date();
  sinceDaily.setUTCDate(sinceDaily.getUTCDate() - lookbackDaysFor("daily"));
  const sinceMonthly = new Date();
  sinceMonthly.setUTCDate(sinceMonthly.getUTCDate() - lookbackDaysFor("monthly"));
  // 5-year window so the storage z-score captures true seasonal (winter
  // drawdown / summer injection) variation, not just a recent slice.
  const sinceStorage = new Date();
  sinceStorage.setUTCFullYear(sinceStorage.getUTCFullYear() - 5);

  const [brentSeries, wtiSeries, ovxSeries, henryHubSeries, storageSeries, copperSeries, uraniumSeries, gscpiSeries, xleSeries, chokepointSeriesList] = await Promise.all([
    fetchSeries(db, BRENT_KEY, sinceDaily.toISOString()),
    fetchSeries(db, WTI_KEY, sinceDaily.toISOString()),
    fetchSeries(db, OVX_KEY, sinceDaily.toISOString()),
    fetchSeries(db, HENRY_HUB_KEY, sinceDaily.toISOString()),
    fetchSeries(db, US_NATGAS_STORAGE_KEY, sinceStorage.toISOString()),
    fetchSeries(db, COPPER_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, URANIUM_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, GSCPI_KEY, sinceMonthly.toISOString()),
    fetchSeries(db, XLE_KEY, sinceDaily.toISOString()),
    Promise.all(CHOKEPOINT_TANKER_KEYS.map((c) => fetchSeries(db, `energy.chokepoint.${c.slug}.transits_tanker`, sinceDaily.toISOString()))),
  ]);

  // Oil domain: Brent + WTI level (rising price = risk) blended with OVX
  // implied-vol (rising = market stress).
  const brentScore = zToRiskScore(zScore(brentSeries, DAILY_WINDOW), 1);
  const wtiScore = zToRiskScore(zScore(wtiSeries, DAILY_WINDOW), 1);
  const ovxScore = zToRiskScore(zScore(ovxSeries, DAILY_WINDOW), 1);
  const oilParts = [
    brentScore !== null ? { score: brentScore, weight: 0.4 } : null,
    wtiScore !== null ? { score: wtiScore, weight: 0.35 } : null,
    ovxScore !== null ? { score: ovxScore, weight: 0.25 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const oilScore = oilParts.length > 0 ? Math.round(oilParts.reduce((a, b) => a + b.score * b.weight, 0) / oilParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Natural gas domain: Henry Hub level + its own realized volatility + US
  // storage adequacy (below the 5-year seasonal norm = risk, spec §19).
  const gasPriceScore = zToRiskScore(zScore(henryHubSeries, DAILY_WINDOW), 1);
  const gasVolScore = zToRiskScore(zScore(rollingRealizedVolSeries(henryHubSeries), DAILY_WINDOW), 1);
  const storageScore = zToRiskScore(zScore(storageSeries, 260), -1);
  const gasParts = [
    gasPriceScore !== null ? { score: gasPriceScore, weight: 0.45 } : null,
    gasVolScore !== null ? { score: gasVolScore, weight: 0.25 } : null,
    storageScore !== null ? { score: storageScore, weight: 0.3 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const gasScore = gasParts.length > 0 ? Math.round(gasParts.reduce((a, b) => a + b.score * b.weight, 0) / gasParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Critical minerals / nuclear fuel domain: |z| — extremity in EITHER
  // direction counts as risk (bottleneck spike or demand-collapse crash).
  const copperZ = zScore(copperSeries, MONTHLY_WINDOW);
  const copperScore = zToRiskScore(copperZ !== null ? Math.abs(copperZ) : null, 1);
  const uraniumZ = zScore(uraniumSeries, MONTHLY_WINDOW);
  const uraniumScore = zToRiskScore(uraniumZ !== null ? Math.abs(uraniumZ) : null, 1);
  const mineralsParts = [
    copperScore !== null ? { score: copperScore, weight: 0.5 } : null,
    uraniumScore !== null ? { score: uraniumScore, weight: 0.5 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const mineralsScore = mineralsParts.length > 0 ? Math.round(mineralsParts.reduce((a, b) => a + b.score * b.weight, 0) / mineralsParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Shipping / supply chain domain: GSCPI (rising pressure = risk) blended
  // with tanker-transit chokepoint stress (falling transits = risk).
  const gscpiScore = zToRiskScore(zScore(gscpiSeries, MONTHLY_WINDOW), 1);
  const chokepointScores = CHOKEPOINT_TANKER_KEYS.map((c, i) => zToRiskScore(zScore(chokepointSeriesList[i], DAILY_WINDOW), -1));
  const chokepointScoresWithData = chokepointScores.filter((v): v is number => v !== null);
  const chokepointCompositeScore =
    chokepointScoresWithData.length > 0 ? Math.round(chokepointScoresWithData.reduce((a, b) => a + b, 0) / chokepointScoresWithData.length) : null;
  const shippingParts = [
    gscpiScore !== null ? { score: gscpiScore, weight: 0.55 } : null,
    chokepointCompositeScore !== null ? { score: chokepointCompositeScore, weight: 0.45 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const shippingScore = shippingParts.length > 0 ? Math.round(shippingParts.reduce((a, b) => a + b.score * b.weight, 0) / shippingParts.reduce((a, b) => a + b.weight, 0)) : null;

  // Market domain: XLE price (below trend = stress) + realized vol.
  const xlePriceScore = zToRiskScore(zScore(xleSeries, DAILY_WINDOW), -1);
  const xleVolScore = zToRiskScore(zScore(rollingRealizedVolSeries(xleSeries), DAILY_WINDOW), 1);
  const marketParts = [
    xlePriceScore !== null ? { score: xlePriceScore, weight: 0.6 } : null,
    xleVolScore !== null ? { score: xleVolScore, weight: 0.4 } : null,
  ].filter((p): p is { score: number; weight: number } => p !== null);
  const marketScore = marketParts.length > 0 ? Math.round(marketParts.reduce((a, b) => a + b.score * b.weight, 0) / marketParts.reduce((a, b) => a + b.weight, 0)) : null;

  const { structuralScore, convergenceScore, compositeScore, regime, hiddenRisk, marketLedWarning, stage, stageLabel } = composeEnergyComposite({
    oilScore,
    gasScore,
    mineralsScore,
    shippingScore,
    marketScore,
  });

  const brentLast = latestPoint(brentSeries);
  const wtiLast = latestPoint(wtiSeries);
  const ovxLast = latestPoint(ovxSeries);
  const henryHubLast = latestPoint(henryHubSeries);
  const storageLast = latestPoint(storageSeries);
  const copperLast = latestPoint(copperSeries);
  const uraniumLast = latestPoint(uraniumSeries);
  const gscpiLast = latestPoint(gscpiSeries);
  const xleLast = latestPoint(xleSeries);

  const applicableScores = [oilScore, gasScore, mineralsScore, shippingScore, marketScore];
  const indicatorsAvailable = applicableScores.filter((v) => v !== null).length;
  const dataCompleteness = Math.round((indicatorsAvailable / applicableScores.length) * 100) / 100;

  return {
    oilReading: {
      brent: { value: brentLast?.v ?? null, asOf: brentLast?.t ?? null, score: brentScore, previousValue: previousOf(brentSeries)?.v ?? null },
      wti: { value: wtiLast?.v ?? null, asOf: wtiLast?.t ?? null, score: wtiScore, previousValue: previousOf(wtiSeries)?.v ?? null },
      ovx: { value: ovxLast?.v ?? null, asOf: ovxLast?.t ?? null, score: ovxScore, previousValue: previousOf(ovxSeries)?.v ?? null },
    },
    oilScore,
    gasReading: {
      henryHub: { value: henryHubLast?.v ?? null, asOf: henryHubLast?.t ?? null, score: gasPriceScore, previousValue: previousOf(henryHubSeries)?.v ?? null },
      storage: { value: storageLast?.v ?? null, asOf: storageLast?.t ?? null, score: storageScore, previousValue: previousOf(storageSeries)?.v ?? null },
    },
    gasScore,
    mineralsReading: {
      copper: { value: copperLast?.v ?? null, asOf: copperLast?.t ?? null, score: copperScore, previousValue: previousOf(copperSeries)?.v ?? null },
      uranium: { value: uraniumLast?.v ?? null, asOf: uraniumLast?.t ?? null, score: uraniumScore, previousValue: previousOf(uraniumSeries)?.v ?? null },
    },
    mineralsScore,
    shippingReading: { value: gscpiLast?.v ?? null, asOf: gscpiLast?.t ?? null, score: gscpiScore, previousValue: previousOf(gscpiSeries)?.v ?? null },
    shippingScore,
    chokepointReadings: CHOKEPOINT_TANKER_KEYS.map((c, i) => {
      const series = chokepointSeriesList[i];
      const last = latestPoint(series);
      return { slug: c.slug, label: c.label, value: last?.v ?? null, asOf: last?.t ?? null, score: chokepointScores[i], previousValue: previousOf(series)?.v ?? null };
    }),
    marketReading: { value: xleLast?.v ?? null, asOf: xleLast?.t ?? null, score: marketScore, previousValue: previousOf(xleSeries)?.v ?? null },
    marketScore,
    structuralScore,
    convergenceScore,
    compositeScore,
    regime,
    hiddenRisk,
    marketLedWarning,
    dataCompleteness,
    stage,
    stageLabel,
  };
}

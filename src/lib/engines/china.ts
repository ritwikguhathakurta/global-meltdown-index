import type { EngineContext, EngineResult, Horizon, IndicatorRef } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * China engine (V3 §24) — explicitly partial. Property sales transactions,
 * developer financing/defaults, LGFV debt, bank NPLs, credit impulse and PMI
 * new orders are all in the document's indicator list but have no free daily
 * source (China macro data of this granularity is behind paid providers like
 * CEIC/Wind), and no free source publishes a China government bond yield at
 * all. Surfaced as UNAVAILABLE per V3 §63 rather than omitted or faked. Real
 * property *prices* (BIS index, as opposed to sales volumes) and mainland
 * equities are now tracked here via the shared cross-country series also used
 * by the Property/Equity Fragility/Credit engines.
 */
const UNAVAILABLE_INDICATORS: { key: string; label: string; classification: "leading" | "coincident" | "lagging" }[] = [
  { key: "china.property_sales", label: "China Property Sales (transaction volume)", classification: "leading" },
  { key: "china.developer_financing", label: "China Developer Financing/Defaults", classification: "leading" },
  { key: "china.credit_impulse", label: "China Credit Impulse", classification: "leading" },
  { key: "china.pmi_new_orders", label: "China PMI New Orders", classification: "leading" },
  { key: "china.lgfv_debt", label: "LGFV (Local Government Financing Vehicle) Debt", classification: "lagging" },
  { key: "yield.china_10y", label: "China 10Y Government Bond Yield", classification: "coincident" },
];

function unavailableRef(u: (typeof UNAVAILABLE_INDICATORS)[number]): IndicatorRef {
  return { key: u.key, label: u.label, classification: u.classification, value: null, status: "UNAVAILABLE", sourceKey: "none", sourceTier: 5, asOf: null };
}

export async function runChinaEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [exports, imports, cny, cpi, interbankRate, hpi, shanghai] = await Promise.all([
    buildIndicator(ctx.db, "china.exports_cny", "China Exports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "china.imports_cny", "China Imports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "fx.usdcny", "USDCNY", "coincident", "daily", "CNY"),
    buildIndicator(ctx.db, "china.cpi_index", "China CPI Index", "lagging", "monthly", "index"),
    buildIndicator(ctx.db, "china.interbank_rate_3m", "China 3M Interbank Rate (SHIBOR-equivalent)", "leading", "monthly", "%"),
    buildIndicator(ctx.db, "property.hpi_real_china", "China Real House Price Index (BIS)", "leading", "quarterly", "index"),
    buildIndicator(ctx.db, "equity.shanghai_composite", "Shanghai Composite", "coincident", "daily", "index"),
  ]);

  return composeEngineResult({
    engineKey: "china",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["EXPANDING", "STABLE", "SLOWING", "STRESSED", "CRISIS"],
    inputs: [
      { ref: exports.ref, series: exports.series, weight: 0.6, zDirection: -1 },
      { ref: imports.ref, series: imports.series, weight: 0.5, zDirection: -1 },
      { ref: cny.ref, series: cny.series, weight: 0.9, zDirection: 1 },
      { ref: cpi.ref, series: cpi.series, weight: 0.3, zDirection: -1 },
      { ref: interbankRate.ref, series: interbankRate.series, weight: 0.5, zDirection: 1 },
      { ref: hpi.ref, series: hpi.series, weight: 0.8, zDirection: -1 },
      { ref: shanghai.ref, series: shanghai.series, weight: 0.6, zDirection: -1 },
      ...UNAVAILABLE_INDICATORS.map((u) => ({ ref: unavailableRef(u), series: [], weight: 1, zDirection: 1 as const })),
    ],
    triggerDesc:
      "A sustained CNY depreciation pressure (rather than a managed, gradual move) alongside declining trade volumes, falling real house prices and a rising interbank funding rate would indicate capital-outflow or growth-confidence stress — this is a broader read than the pure global-shock-sensitivity proxy this engine started as, but still not the full property-transactions/credit-impulse/PMI read the V3 spec envisions (see UNAVAILABLE indicators above).",
    transmissionMechanism:
      "CNY stress transmits globally through China's role as the largest trading partner for most economies and commodity-demand channels; property stress transmits through developer/LGFV financing and bank asset quality; both can trigger — if disorderly — a repeat of the 2015-16 global growth-scare or 2021-23 property-sector deleveraging pattern.",
    amplifiers: ["Simultaneous Energy engine weakness (China is the largest commodity importer)", "Simultaneous Supply Chains engine deterioration", "Real house prices and equities declining together with FX pressure (broad-based, not one-market, stress)"],
    invalidationConditions: ["CNY stabilizes within its managed band", "Trade volumes and real house prices stabilize"],
    confirmationConditions: ["A confirmed PBOC policy response (rate cut, RRR cut, or explicit FX intervention) — not tracked, requires PBOC statement monitoring not yet built"],
    notYetHappened: ["No confirmed disorderly CNY depreciation in the tracked series"],
    contradictoryEvidence: ["This engine still cannot see property transaction volumes, credit impulse, PMI or a sovereign bond yield for China — a genuinely deteriorating economy could exist without fully showing up here"],
    methodologyVersion: "v0.2-freedata-partial",
  });
}

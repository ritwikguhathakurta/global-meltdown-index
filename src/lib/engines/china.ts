import type { EngineContext, EngineResult, Horizon, IndicatorRef } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * China engine (V3 §24) — explicitly partial. Property sales/prices,
 * developer financing/defaults, LGFV debt, bank NPLs, credit impulse and PMI
 * new orders are all in the document's indicator list but have no free daily
 * source (China macro data of this granularity is behind paid providers like
 * CEIC/Wind). Surfaced as UNAVAILABLE per V3 §63 rather than omitted or faked.
 */
const UNAVAILABLE_INDICATORS: { key: string; label: string; classification: "leading" | "coincident" | "lagging" }[] = [
  { key: "china.property_sales", label: "China Property Sales", classification: "leading" },
  { key: "china.developer_financing", label: "China Developer Financing/Defaults", classification: "leading" },
  { key: "china.credit_impulse", label: "China Credit Impulse", classification: "leading" },
  { key: "china.pmi_new_orders", label: "China PMI New Orders", classification: "leading" },
  { key: "china.lgfv_debt", label: "LGFV (Local Government Financing Vehicle) Debt", classification: "lagging" },
];

function unavailableRef(u: (typeof UNAVAILABLE_INDICATORS)[number]): IndicatorRef {
  return { key: u.key, label: u.label, classification: u.classification, value: null, status: "UNAVAILABLE", sourceKey: "none", sourceTier: 5, asOf: null };
}

export async function runChinaEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [exports, imports, cny, cpi] = await Promise.all([
    buildIndicator(ctx.db, "china.exports_cny", "China Exports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "china.imports_cny", "China Imports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "fx.usdcny", "USDCNY", "coincident", "daily", "CNY"),
    buildIndicator(ctx.db, "china.cpi_index", "China CPI Index", "lagging", "monthly", "index"),
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
      ...UNAVAILABLE_INDICATORS.map((u) => ({ ref: unavailableRef(u), series: [], weight: 1, zDirection: 1 as const })),
    ],
    triggerDesc:
      "A sustained CNY depreciation pressure (rather than a managed, gradual move) alongside declining trade volumes would indicate capital-outflow or growth-confidence stress — this is a global-shock-sensitivity proxy, not the property/credit-cycle read the full V3 spec envisions (see UNAVAILABLE indicators above).",
    transmissionMechanism:
      "CNY stress transmits globally through China's role as the largest trading partner for most economies, commodity-demand channels, and — if disorderly — a repeat of the 2015-16 global growth-scare pattern via competitive-devaluation fears.",
    amplifiers: ["Simultaneous Energy engine weakness (China is the largest commodity importer)", "Simultaneous Supply Chains engine deterioration"],
    invalidationConditions: ["CNY stabilizes within its managed band", "Trade volumes stabilize"],
    confirmationConditions: ["A confirmed PBOC policy response (rate cut, RRR cut, or explicit FX intervention) — not tracked, requires PBOC statement monitoring not yet built"],
    notYetHappened: ["No confirmed disorderly CNY depreciation in the tracked series"],
    contradictoryEvidence: ["This engine cannot see property, credit-impulse or PMI data — a genuinely deteriorating China economy could exist without showing up here yet"],
    methodologyVersion: "v0.1-freedata-partial",
  });
}

import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * China engine (V3 §24). Every indicator the V3 spec calls for now has a
 * real, verified, free source — none of the original UNAVAILABLE list
 * remains:
 *
 * - Property sales, PMI new orders & developer financing: NBS's own
 *   monthly English press releases, reached via english.www.gov.cn (the
 *   State Council's English portal, which syndicates NBS content) rather
 *   than stats.gov.cn directly — stats.gov.cn actively blocks non-browser
 *   HTTP clients (a WAF 403 on its data API, a TLS-level ECONNRESET on its
 *   press pages), which this project will not work around. Developer
 *   financing is honestly a proxy here, not NBS's literal "funds in place"
 *   financing-source breakdown (that specific release only exists on the
 *   blocked domain) — it's the year-on-year change in real estate
 *   development investment itself, from the same syndicated release. See
 *   govCnStatistics.ts for the full reasoning, the exact prose patterns
 *   matched, and the property-sales YTD de-cumulation approach.
 * - Credit impulse: BIS's official Credit-to-GDP Gap for China — the
 *   Basel III countercyclical-buffer signal — used as the free, official,
 *   already-computed stand-in for a literal credit-impulse calculation.
 *   See bisCreditGap.ts.
 * - LGFV debt: the IMF's own annual "Augmented Debt" staff estimate from
 *   the China Article IV Consultation report — the only place a real LGFV
 *   figure exists at all (no routine Chinese statistic covers this), so it
 *   is a manually-refreshed annual figure, not a live feed. See
 *   imfAugmentedDebt.ts for the exact source citation and refresh process.
 *
 * The one thing genuinely still missing is developer-level *default*
 * events (as opposed to the aggregate financing/investment trend above) —
 * no free source tracks individual Chinese developer bond defaults in
 * structured form; that gap is disclosed in contradictoryEvidence below
 * rather than silently dropped. Real property *prices* (BIS index, as
 * opposed to sales volumes), mainland equities, the government debt/GDP
 * ratio and the 10Y government bond yield are tracked here too (the yield
 * via ChinaBond/CCDC directly — see chinaBondYield.ts and treasury.ts's
 * docstring).
 */
export async function runChinaEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [exports, imports, cny, cpi, interbankRate, hpi, shanghai, yield10y, debtToGdp, propertySales, creditImpulse, pmiNewOrders, lgfvDebt, developerFinancing] = await Promise.all([
    buildIndicator(ctx.db, "china.exports_cny", "China Exports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "china.imports_cny", "China Imports (CNY)", "leading", "monthly", "CNY"),
    buildIndicator(ctx.db, "fx.usdcny", "USDCNY", "coincident", "daily", "CNY"),
    buildIndicator(ctx.db, "china.cpi_index", "China CPI Index", "lagging", "monthly", "index"),
    buildIndicator(ctx.db, "china.interbank_rate_3m", "China 3M Interbank Rate (SHIBOR-equivalent)", "leading", "monthly", "%"),
    buildIndicator(ctx.db, "property.hpi_real_china", "China Real House Price Index (BIS)", "leading", "quarterly", "index"),
    buildIndicator(ctx.db, "equity.shanghai_composite", "Shanghai Composite", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "yield.china_10y", "China 10Y Government Bond Yield (ChinaBond/CCDC, daily)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "sovereign.china_debt_to_gdp", "China Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "china.property_sales", "China Property Sales (floor space sold, NBS)", "leading", "monthly", "million m²"),
    buildIndicator(ctx.db, "china.credit_impulse", "China Credit-to-GDP Gap (BIS, credit-impulse proxy)", "leading", "quarterly", "pp of GDP"),
    buildIndicator(ctx.db, "china.pmi_new_orders", "China Manufacturing PMI New Orders (NBS)", "leading", "monthly", "index"),
    buildIndicator(ctx.db, "china.lgfv_debt", "China Augmented Debt incl. LGFVs (IMF Article IV)", "lagging", "annual", "% of GDP"),
    buildIndicator(ctx.db, "china.developer_financing", "China Real Estate Development Investment YoY (NBS, developer-financing proxy)", "leading", "monthly", "% YoY"),
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
      { ref: yield10y.ref, series: yield10y.series, weight: 0.5, zDirection: 1 },
      { ref: debtToGdp.ref, series: debtToGdp.series, weight: 0.3, zDirection: 1 },
      { ref: propertySales.ref, series: propertySales.series, weight: 0.9, zDirection: -1 },
      { ref: creditImpulse.ref, series: creditImpulse.series, weight: 0.8, zDirection: 1 },
      { ref: pmiNewOrders.ref, series: pmiNewOrders.series, weight: 0.7, zDirection: -1 },
      { ref: lgfvDebt.ref, series: lgfvDebt.series, weight: 0.6, zDirection: 1 },
      { ref: developerFinancing.ref, series: developerFinancing.series, weight: 0.6, zDirection: -1 },
    ],
    triggerDesc:
      "A sustained CNY depreciation pressure (rather than a managed, gradual move) alongside declining trade volumes, falling property sales, real house prices and developer investment, a widening BIS credit-to-GDP gap, softening PMI new orders, rising LGFV-inclusive augmented debt, and a rising interbank funding rate would indicate capital-outflow, credit-boom-unwind or growth-confidence stress.",
    transmissionMechanism:
      "CNY stress transmits globally through China's role as the largest trading partner for most economies and commodity-demand channels; property stress transmits through developer/LGFV financing and bank asset quality; both can trigger — if disorderly — a repeat of the 2015-16 global growth-scare or 2021-23 property-sector deleveraging pattern.",
    amplifiers: ["Simultaneous Energy engine weakness (China is the largest commodity importer)", "Simultaneous Supply Chains engine deterioration", "Real house prices, property sales, developer investment and equities declining together with FX pressure (broad-based, not one-market, stress)"],
    invalidationConditions: ["CNY stabilizes within its managed band", "Trade volumes, property sales and real house prices stabilize"],
    confirmationConditions: ["A confirmed PBOC policy response (rate cut, RRR cut, or explicit FX intervention) — not tracked, requires PBOC statement monitoring not yet built"],
    notYetHappened: ["No confirmed disorderly CNY depreciation in the tracked series"],
    contradictoryEvidence: ["Individual developer bond default events are still unavailable free (only the aggregate investment trend is tracked) — a single large developer default could precede any aggregate signal here", "LGFV debt is a manually-refreshed annual IMF staff estimate, not a live feed — a fast-moving LGFV stress episode within a year won't show up here until the next Article IV report"],
    methodologyVersion: "v0.5-freedata-govcn-developer-financing",
  });
}

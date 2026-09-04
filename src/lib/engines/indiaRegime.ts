import type { EngineContext, EngineResult, Horizon, IndicatorRef } from "./types";
import { buildIndicator } from "./indicator";
import { zScore, changeOverDays, clamp } from "../metrics/stats";

/**
 * India Market Regime (V3 §40-42). Unlike the risk engines, this axis runs
 * BEARISH (0) -> STRONGLY_BULLISH (100), per the document's own scale, not a
 * 0-100 danger score. FII/DII flows, credit growth, and PMI new orders are in
 * the document's indicator list but have no free daily source yet — they are
 * surfaced as UNAVAILABLE rather than omitted silently, per V3 §63.
 */

function classify(score: number): string {
  if (score < 30) return "BEARISH";
  if (score < 45) return "SLIGHTLY_BEARISH";
  if (score < 55) return "NEUTRAL";
  if (score < 70) return "BULLISH";
  return "STRONGLY_BULLISH";
}

const UNAVAILABLE_INDICATORS: { key: string; label: string; classification: "leading" | "coincident" | "lagging" }[] = [
  { key: "india.fii_futures_positioning", label: "FII Index Futures Positioning", classification: "leading" },
  { key: "india.fii_dii_flows", label: "FII/DII Cash Flows", classification: "leading" },
  { key: "india.pmi_new_orders", label: "India PMI New Orders", classification: "leading" },
  { key: "india.credit_growth", label: "Bank Credit Growth", classification: "leading" },
  { key: "india.gst_collections", label: "GST Collections", classification: "coincident" },
];

function unavailableRef(u: (typeof UNAVAILABLE_INDICATORS)[number]): IndicatorRef {
  return {
    key: u.key,
    label: u.label,
    classification: u.classification,
    value: null,
    status: "UNAVAILABLE",
    sourceKey: "none",
    sourceTier: 5,
    asOf: null,
  };
}

export async function runIndiaRegimeEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [nifty, usdinr, us10y, dxy, vix, usdjpy] = await Promise.all([
    buildIndicator(ctx.db, "equity.nifty50", "Nifty 50", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "fx.usdinr", "USDINR", "coincident", "daily", "INR"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Yield", "leading", "daily", "%"),
    buildIndicator(ctx.db, "fx.dxy_broad", "DXY (Broad Dollar Index)", "leading", "daily", "index"),
    buildIndicator(ctx.db, "vol.vix", "VIX", "leading", "daily", "index"),
    buildIndicator(ctx.db, "fx.usdjpy", "USDJPY", "leading", "daily", "JPY"),
  ]);

  const bullishSignals: { key: string; label: string; z: number; weight: number }[] = [];
  function addSignal(ref: IndicatorRef, series: { t: string; v: number }[], weight: number, higherIsBullish: boolean) {
    if (ref.status === "UNAVAILABLE" || series.length < 20) return;
    const z = zScore(series, 252);
    if (z === null) return;
    bullishSignals.push({ key: ref.key, label: ref.label, z: higherIsBullish ? z : -z, weight });
  }

  addSignal(nifty.ref, nifty.series, 0, true); // Nifty itself is the target, not an input driver
  addSignal(usdinr.ref, usdinr.series, 0.8, false); // INR strength (falling USDINR) = bullish
  addSignal(us10y.ref, us10y.series, 0.7, false); // rising US yields = headwind
  addSignal(dxy.ref, dxy.series, 0.9, false); // rising dollar = headwind
  addSignal(vix.ref, vix.series, 0.9, false); // rising VIX = risk-off headwind
  addSignal(usdjpy.ref, usdjpy.series, 0.4, false); // yen carry unwind (falling USDJPY) = headwind

  const totalWeight = bullishSignals.reduce((a, b) => a + b.weight, 0);
  const rawScore =
    bullishSignals.length > 0 && totalWeight > 0
      ? 50 + (bullishSignals.reduce((a, b) => a + clamp(b.z, -3, 3) * b.weight, 0) / totalWeight) * 16.67
      : null;
  const score = rawScore === null ? null : Math.round(clamp(rawScore, 0, 100));

  const dataCompleteness =
    ([nifty, usdinr, us10y, dxy, vix, usdjpy].filter((i) => i.ref.status !== "UNAVAILABLE").length +
      0) /
    (6 + UNAVAILABLE_INDICATORS.length);

  const topDrivers = [...bullishSignals]
    .filter((s) => s.weight > 0)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 5)
    .map((s) => ({ key: s.key, label: s.label, contribution: Math.round(s.z * 100) / 100 }));

  let direction: EngineResult["direction"] = "unknown";
  const niftyDelta = changeOverDays(nifty.series, 20);
  if (niftyDelta !== null) direction = niftyDelta > 0 ? "improving" : niftyDelta < 0 ? "deteriorating" : "stable";

  const leadingIndicators = [us10y.ref, dxy.ref, vix.ref, usdjpy.ref, ...UNAVAILABLE_INDICATORS.filter(u => u.classification === "leading").map(unavailableRef)];
  const coincidentIndicators = [nifty.ref, usdinr.ref, ...UNAVAILABLE_INDICATORS.filter(u => u.classification === "coincident").map(unavailableRef)];

  return {
    engineKey: "india_regime",
    asOf: ctx.asOf,
    horizon,
    score,
    direction,
    regime: score === null ? "INSUFFICIENT_DATA" : classify(score),
    confidence: Math.round(dataCompleteness * 100) / 100,
    topDrivers,
    leadingIndicators,
    coincidentIndicators,
    laggingIndicators: [],
    contradictoryEvidence: [],
    notYetHappened: [
      "FII futures positioning, FII/DII cash flows, PMI new orders, bank credit growth and GST collections are not yet wired to a free data source (see India engine coverage gaps) — treat this regime read as global-shock-sensitivity only until those are added",
    ],
    triggerDesc:
      "A simultaneous rise in DXY, US 10Y yields and VIX alongside INR weakness has historically coincided with FII outflow pressure on Indian equities.",
    amplifiers: ["Yen-carry unwind pressuring broader EM/Asia risk appetite", "Simultaneous global liquidity tightening"],
    transmissionMechanism:
      "Dollar strength and rising US real yields reduce the relative attractiveness of EM assets, prompting FII outflows that pressure both the Nifty and INR simultaneously.",
    invalidationConditions: ["DXY and US 10Y stabilize or fall", "INR stabilizes against the dollar", "VIX reverts to trailing median"],
    confirmationConditions: ["FII cash outflows are confirmed once that data source is added", "Bank Nifty underperforms broader Nifty (credit-sensitivity confirmation, not yet tracked)"],
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    methodologyVersion: "v0.1-freedata-partial",
  };
}

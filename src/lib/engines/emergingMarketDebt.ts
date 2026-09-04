import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runEmergingMarketDebtEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [emOas, emDollarIdx, usdbrl, usdzar, usdmxn] = await Promise.all([
    buildIndicator(ctx.db, "credit.em_oas", "ICE BofA EM Corporate Plus OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.em_dollar_index", "Broad Emerging Market Dollar Index", "leading", "daily", "index"),
    buildIndicator(ctx.db, "fx.usdbrl", "USDBRL", "coincident", "daily", "BRL"),
    buildIndicator(ctx.db, "fx.usdzar", "USDZAR", "coincident", "daily", "ZAR"),
    buildIndicator(ctx.db, "fx.usdmxn", "USDMXN", "coincident", "daily", "MXN"),
  ]);

  return composeEngineResult({
    engineKey: "emerging_market_debt",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE_ACCESS", "NORMAL", "TIGHTENING", "FUNDING_STRESS", "SUDDEN_STOP"],
    inputs: [
      { ref: emOas.ref, series: emOas.series, weight: 1.0, zDirection: 1 },
      { ref: emDollarIdx.ref, series: emDollarIdx.series, weight: 0.9, zDirection: 1 },
      { ref: usdbrl.ref, series: usdbrl.series, weight: 0.5, zDirection: 1 },
      { ref: usdzar.ref, series: usdzar.series, weight: 0.5, zDirection: 1 },
      { ref: usdmxn.ref, series: usdmxn.series, weight: 0.4, zDirection: 1 },
    ],
    triggerDesc:
      "A broad, simultaneous depreciation of high-beta EM currencies (BRL, ZAR, MXN together, not just one idiosyncratic move) alongside a widening EM dollar-bond spread is the classic 'sudden stop' pattern — dollar funding for EM issuers becomes scarce and expensive at the same time.",
    transmissionMechanism:
      "EM sovereigns and corporates with dollar-denominated debt face a rising local-currency cost of debt service as their currency weakens, while widening spreads raise the cost (or close the window) of rolling that debt at maturity.",
    amplifiers: ["Simultaneous US Treasury yield spike (dollar funding cost rises everywhere at once)", "A high-profile EM sovereign credit event", "Simultaneous Yen Carry unwind (cross-carry contagion into EM FX)"],
    invalidationConditions: ["EM currencies stabilize or strengthen together", "EM corporate OAS compresses back toward its trailing median"],
    confirmationConditions: ["EM local-currency bond yields spike alongside FX weakness", "A credit-rating action on a major EM sovereign"],
    notYetHappened: ["No confirmed simultaneous, broad-based EM currency depreciation across the tracked BRL/ZAR/MXN basket"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

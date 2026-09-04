import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runCreditEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [hy, ig, em, euroHy] = await Promise.all([
    buildIndicator(ctx.db, "credit.hy_oas", "US High-Yield OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.ig_oas", "US Investment-Grade OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.em_oas", "EM Corporate Bond OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.euro_hy_oas", "Euro-Area High-Yield OAS", "coincident", "daily", "%"),
  ]);

  return composeEngineResult({
    engineKey: "credit",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["COMPRESSED", "NORMAL", "WIDENING", "STRESSED", "DISLOCATED"],
    inputs: [
      { ref: hy.ref, series: hy.series, weight: 1.2, zDirection: 1 },
      { ref: ig.ref, series: ig.series, weight: 0.8, zDirection: 1 },
      { ref: em.ref, series: em.series, weight: 1.0, zDirection: 1 },
      { ref: euroHy.ref, series: euroHy.series, weight: 0.9, zDirection: 1 },
    ],
    triggerDesc: "A rapid widening in HY/IG OAS spreads, especially outpacing equity-market moves, historically signals credit-market repricing of default risk ahead of broader risk-asset stress. US and Euro-area high-yield widening together (rather than one region only) indicates broad-based, not regional, credit stress.",
    transmissionMechanism: "Wider spreads raise refinancing costs for leveraged issuers, which can trigger downgrades, forced selling by mandate-constrained funds, and tightening bank lending standards.",
    amplifiers: ["Simultaneous private-credit or leveraged-loan stress", "Large maturity wall concentrated in near-dated years", "Rating-agency downgrade cycle"],
    invalidationConditions: ["Spreads retrace toward trailing-year median", "New issuance market reopens at reasonable concessions"],
    confirmationConditions: ["Leveraged-loan default rate rises (not yet tracked — Phase 2)", "CDX HY/IG index confirms cash-bond move (not yet tracked — Phase 2)"],
    notYetHappened: ["No confirmed acceleration in reported corporate default rates yet"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

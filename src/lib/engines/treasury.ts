import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runTreasuryEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [us2y, us10y, us30y, debtToGdp] = await Promise.all([
    buildIndicator(ctx.db, "yield.us02y", "US 2Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us30y", "US 30Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "sovereign.us_debt_to_gdp", "US Federal Debt / GDP", "lagging", "quarterly", "%"),
  ]);

  return composeEngineResult({
    engineKey: "us_treasury_sovereign",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["WELL_ABSORBED", "NORMAL", "SOFTENING_DEMAND", "FUNDING_STRESS", "DISLOCATED"],
    inputs: [
      { ref: us2y.ref, series: us2y.series, weight: 0.6, zDirection: 1 },
      { ref: us10y.ref, series: us10y.series, weight: 1.0, zDirection: 1 },
      { ref: us30y.ref, series: us30y.series, weight: 0.8, zDirection: 1 },
      { ref: debtToGdp.ref, series: debtToGdp.series, weight: 0.6, zDirection: 1 },
    ],
    triggerDesc:
      "A rapid, disorderly rise in long-end Treasury yields (rising term premium rather than growth optimism) alongside a rising debt/GDP trajectory would indicate deteriorating sovereign funding conditions.",
    transmissionMechanism:
      "Higher long-end yields raise the government's own interest expense (crowding out other spending), repricing risk assets that discount off the risk-free curve, and raising mortgage/corporate borrowing costs economy-wide.",
    amplifiers: ["Weak auction demand (not yet tracked here — Phase 2: bid-to-cover, indirect bidder share)", "Credit-rating outlook downgrade", "Simultaneous foreign official-sector selling"],
    invalidationConditions: ["Long yields fall or stabilize with strong auction demand", "Term premium compresses"],
    confirmationConditions: ["Auction tails widen (not yet tracked — Phase 2)", "CDS on US sovereign debt widens materially"],
    notYetHappened: ["No confirmed pattern of weak Treasury auction demand in tracked data yet"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

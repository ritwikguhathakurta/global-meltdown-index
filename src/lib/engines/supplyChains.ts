import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Supply Chains engine (V3 §24 of engine list), built on the NY Fed's own
 * purpose-built Global Supply Chain Pressure Index — a Tier-1, official,
 * single authoritative source for exactly this question, so a single-input
 * engine is appropriate here rather than a gap.
 */
export async function runSupplyChainsEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const gscpi = await buildIndicator(ctx.db, "supplychain.gscpi", "NY Fed Global Supply Chain Pressure Index", "leading", "monthly", "std_dev");

  return composeEngineResult({
    engineKey: "supply_chains",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["BELOW_AVERAGE", "NORMAL", "BUILDING_PRESSURE", "ELEVATED_PRESSURE", "SEVERE_DISRUPTION"],
    inputs: [{ ref: gscpi.ref, series: gscpi.series, weight: 1.0, zDirection: 1 }],
    triggerDesc:
      "The GSCPI is constructed from shipping costs, delivery times and PMI supply-chain sub-components; a sustained rise (not a single-month blip) has historically led goods-price inflation by one to two quarters.",
    transmissionMechanism:
      "Supply-chain pressure raises input costs and delivery times for goods-producing firms, which passes through to consumer goods prices and can force central banks into a tighter policy stance to contain the inflationary impulse.",
    amplifiers: ["Simultaneous Energy engine shock (shipping fuel costs)", "Simultaneous Geopolitical engine escalation (chokepoint disruption)", "Simultaneous China engine deterioration (China is a dominant node in most global supply chains)"],
    invalidationConditions: ["GSCPI declines back toward zero (its historical-average level)"],
    confirmationConditions: ["Goods-price inflation components confirm the GSCPI move with the typical one-to-two-quarter lag"],
    notYetHappened: ["No confirmed sustained GSCPI breakout beyond its trailing range"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

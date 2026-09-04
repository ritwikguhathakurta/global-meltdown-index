import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runEnergyEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [brent, wti, natgas] = await Promise.all([
    buildIndicator(ctx.db, "commodity.brent", "Brent Crude (spot)", "coincident", "daily", "USD/bbl"),
    buildIndicator(ctx.db, "commodity.wti", "WTI Crude (spot)", "coincident", "daily", "USD/bbl"),
    buildIndicator(ctx.db, "commodity.natgas_henry_hub", "Henry Hub Natural Gas (spot)", "coincident", "daily", "USD/MMBtu"),
  ]);

  return composeEngineResult({
    engineKey: "energy",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE_SUPPLY", "BALANCED", "TIGHTENING", "SHOCK_RISK", "ACTIVE_SHOCK"],
    inputs: [
      { ref: brent.ref, series: brent.series, weight: 1.0, zDirection: 1 },
      { ref: wti.ref, series: wti.series, weight: 0.8, zDirection: 1 },
      { ref: natgas.ref, series: natgas.series, weight: 0.6, zDirection: 1 },
    ],
    triggerDesc:
      "A rapid, sustained spike in Brent/WTI (rather than a one-day move) historically precedes an inflation/stagflation shock with a lag of one to two quarters as the price rise passes through to consumer energy costs and input costs economy-wide.",
    transmissionMechanism:
      "Higher energy prices act as a tax on consumers and energy-intensive industries, pressure central banks into tighter policy to contain the inflationary pass-through, and can trigger current-account stress in energy-importing economies.",
    amplifiers: [
      "OPEC+ spare-capacity reduction (not tracked — no free structured source)",
      "Shipping-lane disruption in a major chokepoint (Strait of Hormuz, Red Sea) — tracked qualitatively via the Geopolitical engine, not numerically here",
      "Simultaneous geopolitical escalation (see Geopolitical engine)",
    ],
    invalidationConditions: ["Prices stabilize or decline toward their trailing range", "No confirmed supply disruption despite elevated prices"],
    confirmationConditions: ["Natural gas confirms the crude move (broad energy-complex shock, not oil-specific)", "Futures curve moves into backwardation (not yet tracked — no free futures-curve source)"],
    notYetHappened: ["No confirmed sustained energy-price shock in the tracked spot series"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

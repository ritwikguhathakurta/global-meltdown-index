import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runPropertyEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [mortgageRate, starts, permits, hpi, existingSales] = await Promise.all([
    buildIndicator(ctx.db, "property.mortgage_rate_30y", "30Y Fixed Mortgage Rate", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "property.housing_starts", "Housing Starts (SAAR)", "leading", "monthly", "thousands"),
    buildIndicator(ctx.db, "property.building_permits", "Building Permits (SAAR)", "leading", "monthly", "thousands"),
    buildIndicator(ctx.db, "property.case_shiller_hpi", "Case-Shiller US National Home Price Index", "lagging", "monthly", "index"),
    buildIndicator(ctx.db, "property.existing_home_sales", "Existing Home Sales (SAAR)", "leading", "monthly", "thousands"),
  ]);

  return composeEngineResult({
    engineKey: "property",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["ROBUST", "STABLE", "COOLING", "CONTRACTING", "DISORDERLY_DECLINE"],
    inputs: [
      { ref: mortgageRate.ref, series: mortgageRate.series, weight: 0.8, zDirection: 1 },
      { ref: starts.ref, series: starts.series, weight: 0.9, zDirection: -1 },
      { ref: permits.ref, series: permits.series, weight: 0.9, zDirection: -1 },
      { ref: hpi.ref, series: hpi.series, weight: 0.5, zDirection: -1 },
      { ref: existingSales.ref, series: existingSales.series, weight: 0.7, zDirection: -1 },
    ],
    triggerDesc:
      "Building permits and housing starts lead price and transaction data by 6-12 months: financing costs rise, new-construction activity contracts first, and only later does that flow through to prices and existing-home transaction volume.",
    transmissionMechanism:
      "A property downturn impairs bank CRE/mortgage collateral value, slows construction-sector employment and household wealth (the housing wealth effect), and — where mortgage credit risk is securitized — can transmit into the broader credit system.",
    amplifiers: [
      "Simultaneous CRE loan delinquency deterioration (see Banking engine)",
      "Regional concentration of construction employment (not tracked at this granularity)",
      "CMBS spread widening (not yet tracked — Phase 2, no free CMBS spread source)",
    ],
    invalidationConditions: ["Mortgage rates decline meaningfully", "Permits/starts stabilize or turn up"],
    confirmationConditions: ["Existing home sales confirm the permits/starts move with the typical lag", "Case-Shiller HPI turns negative on a trailing-12-month basis"],
    notYetHappened: ["No confirmed nationwide home-price decline in the tracked Case-Shiller series"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

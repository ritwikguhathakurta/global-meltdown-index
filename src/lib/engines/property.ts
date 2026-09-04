import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Property/CRE engine (V3 §23), built on the BIS real residential
 * property price index for all G7 economies plus China — the same
 * methodology applied consistently across all eight countries, so
 * cross-country moves are genuinely comparable
 * (unlike mixing one country's nominal index with another's). US-specific
 * leading indicators (mortgage rate, permits, starts, sales) are kept as
 * supplementary context since they have no free G7-wide equivalent, but the
 * core score is deliberately not US-only anymore.
 */
export async function runPropertyEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [hpiUs, hpiCanada, hpiUk, hpiGermany, hpiFrance, hpiItaly, hpiJapan, hpiChina, mortgageRate, starts, permits] = await Promise.all([
    buildIndicator(ctx.db, "property.hpi_real_us", "US Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_canada", "Canada Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_uk", "UK Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_germany", "Germany Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_france", "France Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_italy", "Italy Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_japan", "Japan Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.hpi_real_china", "China Real House Price Index (BIS)", "lagging", "quarterly", "index"),
    buildIndicator(ctx.db, "property.mortgage_rate_30y", "US 30Y Fixed Mortgage Rate", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "property.housing_starts", "US Housing Starts (SAAR)", "leading", "monthly", "thousands"),
    buildIndicator(ctx.db, "property.building_permits", "US Building Permits (SAAR)", "leading", "monthly", "thousands"),
  ]);

  return composeEngineResult({
    engineKey: "property",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["ROBUST", "STABLE", "COOLING", "CONTRACTING", "DISORDERLY_DECLINE"],
    inputs: [
      { ref: hpiUs.ref, series: hpiUs.series, weight: 0.7, zDirection: -1 },
      { ref: hpiCanada.ref, series: hpiCanada.series, weight: 0.7, zDirection: -1 },
      { ref: hpiUk.ref, series: hpiUk.series, weight: 0.6, zDirection: -1 },
      { ref: hpiGermany.ref, series: hpiGermany.series, weight: 0.6, zDirection: -1 },
      { ref: hpiFrance.ref, series: hpiFrance.series, weight: 0.5, zDirection: -1 },
      { ref: hpiItaly.ref, series: hpiItaly.series, weight: 0.4, zDirection: -1 },
      { ref: hpiJapan.ref, series: hpiJapan.series, weight: 0.4, zDirection: -1 },
      { ref: hpiChina.ref, series: hpiChina.series, weight: 0.6, zDirection: -1 },
      { ref: mortgageRate.ref, series: mortgageRate.series, weight: 0.6, zDirection: 1 },
      { ref: starts.ref, series: starts.series, weight: 0.5, zDirection: -1 },
      { ref: permits.ref, series: permits.series, weight: 0.5, zDirection: -1 },
    ],
    triggerDesc:
      "A synchronized real house-price decline across most or all of these eight economies (not one country's idiosyncratic correction) is the pattern that matters systemically — China's property sector in particular has been a well-documented source of global contagion risk since 2021, and US permits/starts lead US prices by 6-12 months, tracked here as the earliest-moving confirmation input.",
    transmissionMechanism:
      "A property downturn impairs bank CRE/mortgage collateral value, slows construction-sector employment and household wealth (the housing wealth effect) in every affected country simultaneously, which is a materially larger shock than one economy alone.",
    amplifiers: [
      "Simultaneous CRE loan delinquency deterioration (see Banking engine)",
      "Three or more tracked economies declining together (broadens from 'one country's housing cycle' to 'synchronized global tightening effect')",
      "China developer-financing stress spilling into confirmed price declines (see China engine)",
      "CMBS spread widening (not yet tracked — Phase 2, no free CMBS spread source)",
    ],
    invalidationConditions: ["US mortgage rates decline meaningfully", "Real HPI stabilizes across most tracked economies"],
    confirmationConditions: ["US permits/starts confirm a broader decline with the typical lag", "A majority of the eight tracked economies show a trailing-year real HPI decline simultaneously"],
    notYetHappened: ["No confirmed synchronized real house-price decline across most tracked economies"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.3-g7-china",
  });
}

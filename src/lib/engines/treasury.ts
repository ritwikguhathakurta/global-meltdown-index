import type { EngineContext, EngineResult, Horizon, IndicatorRef } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { diffSeriesByMonth } from "../metrics/stats";

/**
 * Treasury & Sovereign Debt — G7 + China (V3 §7). Originally US-only, then
 * split into a second "Global Sovereign Debt" engine for the rest of the G7;
 * merged back into a single engine so "Treasury" means what it says: US plus
 * every other G7 government bond market with a free source (UK, Germany,
 * France, Italy, Japan, Canada), not the US alone. The Italy-Germany 10Y
 * spread ("BTP-Bund spread") is the single most-watched eurozone
 * fragmentation-risk gauge, computed here rather than fetched since no free
 * source publishes the spread directly. China has no free government-bond-yield
 * source anywhere (verified — no vendor publishes one without a paid feed), so
 * it is represented by its 3-month interbank rate (the closest free proxy for
 * domestic sovereign-adjacent funding stress) and the bond yield itself is
 * listed as UNAVAILABLE rather than guessed.
 */
const UNAVAILABLE_INDICATORS: { key: string; label: string; classification: "leading" | "coincident" | "lagging" }[] = [
  { key: "yield.china_10y", label: "China 10Y Government Bond Yield", classification: "coincident" },
];

function unavailableRef(u: (typeof UNAVAILABLE_INDICATORS)[number]): IndicatorRef {
  return { key: u.key, label: u.label, classification: u.classification, value: null, status: "UNAVAILABLE", sourceKey: "none", sourceTier: 5, asOf: null };
}

export async function runTreasuryEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [
    us2y,
    us10y,
    us30y,
    usDebt,
    uk10y,
    germany10y,
    italy10y,
    france10y,
    japan10y,
    canada10y,
    germanyDebt,
    italyDebt,
    japanDebt,
    canadaDebt,
    ukDebt,
    chinaInterbank,
  ] = await Promise.all([
    buildIndicator(ctx.db, "yield.us02y", "US 2Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us30y", "US 30Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "sovereign.us_debt_to_gdp", "US Federal Debt / GDP", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "yield.uk_10y", "UK 10Y Gilt Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.germany_10y", "Germany 10Y Bund Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.italy_10y", "Italy 10Y BTP Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.france_10y", "France 10Y OAT Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.japan_10y_proxy", "Japan 10Y JGB Yield (OECD monthly proxy)", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.canada_10y", "Canada 10Y Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "sovereign.germany_debt_to_gdp", "Germany Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.italy_debt_to_gdp", "Italy Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.japan_debt_to_gdp", "Japan Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.canada_debt_to_gdp", "Canada Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.uk_debt_to_gdp", "UK Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "china.interbank_rate_3m", "China 3M Interbank Rate (sovereign-yield proxy)", "leading", "monthly", "%"),
  ]);

  const btpBundSpread = diffSeriesByMonth(italy10y.series, germany10y.series);

  return composeEngineResult({
    engineKey: "us_treasury_sovereign",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["WELL_ABSORBED", "NORMAL", "SOFTENING_DEMAND", "FUNDING_STRESS", "DISLOCATED"],
    inputs: [
      { ref: us2y.ref, series: us2y.series, weight: 0.6, zDirection: 1 },
      { ref: us10y.ref, series: us10y.series, weight: 1.0, zDirection: 1 },
      { ref: us30y.ref, series: us30y.series, weight: 0.8, zDirection: 1 },
      { ref: usDebt.ref, series: usDebt.series, weight: 0.6, zDirection: 1 },
      { ref: uk10y.ref, series: uk10y.series, weight: 0.5, zDirection: 1 },
      { ref: germany10y.ref, series: germany10y.series, weight: 0.4, zDirection: 1 },
      { ref: italy10y.ref, series: italy10y.series, weight: 0.6, zDirection: 1 },
      { ref: france10y.ref, series: france10y.series, weight: 0.4, zDirection: 1 },
      { ref: japan10y.ref, series: japan10y.series, weight: 0.5, zDirection: 1 },
      { ref: canada10y.ref, series: canada10y.series, weight: 0.4, zDirection: 1 },
      {
        ref: { key: "yield.btp_bund_spread", label: "Italy-Germany 10Y Spread (bps, derived)", classification: "leading", value: btpBundSpread.at(-1)?.v ?? null, unit: "bps", status: italy10y.ref.status, sourceKey: italy10y.ref.sourceKey, sourceTier: italy10y.ref.sourceTier, asOf: italy10y.ref.asOf },
        series: btpBundSpread,
        weight: 0.9,
        zDirection: 1,
      },
      { ref: germanyDebt.ref, series: germanyDebt.series, weight: 0.3, zDirection: 1 },
      { ref: italyDebt.ref, series: italyDebt.series, weight: 0.4, zDirection: 1 },
      { ref: japanDebt.ref, series: japanDebt.series, weight: 0.4, zDirection: 1 },
      { ref: canadaDebt.ref, series: canadaDebt.series, weight: 0.3, zDirection: 1 },
      { ref: ukDebt.ref, series: ukDebt.series, weight: 0.3, zDirection: 1 },
      { ref: chinaInterbank.ref, series: chinaInterbank.series, weight: 0.4, zDirection: 1 },
      ...UNAVAILABLE_INDICATORS.map((u) => ({ ref: unavailableRef(u), series: [], weight: 0.5, zDirection: 1 as const })),
    ],
    triggerDesc:
      "A rapid, disorderly rise in long-end yields across the US and its G7 peers (rising term premium rather than growth optimism) — especially a widening Italy-Germany spread, the classic eurozone fragmentation gauge — alongside rising debt/GDP trajectories and China funding-rate stress would indicate broad-based, not idiosyncratic, developed-market sovereign funding deterioration.",
    transmissionMechanism:
      "Higher long-end yields raise governments' own interest expense (crowding out other spending), repricing risk assets that discount off the risk-free curve, and raising mortgage/corporate borrowing costs economy-wide; widening peripheral-vs-core eurozone spreads additionally pressure domestic banks holding that sovereign's debt (the banking-sovereign 'doom loop').",
    amplifiers: ["Weak auction demand (not yet tracked here — bid-to-cover, indirect bidder share)", "A rating-agency outlook downgrade on any tracked issuer", "Simultaneous foreign official-sector selling", "BTP-Bund spread widening beyond its trailing range"],
    invalidationConditions: ["Long yields fall or stabilize with strong auction demand", "Term premium and the BTP-Bund spread compress back toward trailing medians"],
    confirmationConditions: ["Auction tails widen (not yet tracked)", "Sovereign CDS widens materially (not yet tracked)"],
    notYetHappened: ["No confirmed pattern of disorderly weak demand across the tracked sovereign markets"],
    contradictoryEvidence: ["China is represented by an interbank rate proxy, not a sovereign bond yield — no free source publishes one"],
    methodologyVersion: "v0.2-freedata-g7china",
  });
}

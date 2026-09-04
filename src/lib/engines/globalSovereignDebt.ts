import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { diffSeriesByMonth } from "../metrics/stats";

/**
 * Non-US G7 sovereign stress (V3 §7) — UK, Germany, France, Italy, Japan,
 * Canada. Complements — does not duplicate — the existing
 * us_treasury_sovereign engine, which is US-specific by design. The
 * Italy-Germany 10Y spread ("BTP-Bund spread") is the single most-watched
 * eurozone fragmentation-risk gauge, computed here rather than fetched
 * since no free source publishes the spread directly.
 */
export async function runGlobalSovereignDebtEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [uk10y, germany10y, italy10y, france10y, japan10y, canada10y, italyDebt, japanDebt, canadaDebt, ukDebt] = await Promise.all([
    buildIndicator(ctx.db, "yield.uk_10y", "UK 10Y Gilt Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.germany_10y", "Germany 10Y Bund Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.italy_10y", "Italy 10Y BTP Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.france_10y", "France 10Y OAT Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.japan_10y_proxy", "Japan 10Y JGB Yield (OECD monthly proxy)", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.canada_10y", "Canada 10Y Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "sovereign.italy_debt_to_gdp", "Italy Government Debt / GDP", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "sovereign.japan_debt_to_gdp", "Japan Government Debt / GDP", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "sovereign.canada_debt_to_gdp", "Canada Government Debt / GDP", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "sovereign.uk_debt_to_gdp", "UK Government Debt / GDP", "lagging", "quarterly", "%"),
  ]);

  const btpBundSpread = diffSeriesByMonth(italy10y.series, germany10y.series);

  const result = composeEngineResult({
    engineKey: "global_sovereign_debt",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["WELL_ANCHORED", "NORMAL", "DIVERGENCE_BUILDING", "FRAGMENTATION_STRESS", "SOVEREIGN_CRISIS"],
    inputs: [
      { ref: uk10y.ref, series: uk10y.series, weight: 0.6, zDirection: 1 },
      { ref: italy10y.ref, series: italy10y.series, weight: 0.7, zDirection: 1 },
      { ref: france10y.ref, series: france10y.series, weight: 0.5, zDirection: 1 },
      { ref: japan10y.ref, series: japan10y.series, weight: 0.6, zDirection: 1 },
      { ref: canada10y.ref, series: canada10y.series, weight: 0.5, zDirection: 1 },
      {
        ref: { key: "yield.btp_bund_spread", label: "Italy-Germany 10Y Spread (bps, derived)", classification: "leading", value: btpBundSpread.at(-1)?.v ?? null, unit: "bps", status: italy10y.ref.status, sourceKey: italy10y.ref.sourceKey, sourceTier: italy10y.ref.sourceTier, asOf: italy10y.ref.asOf },
        series: btpBundSpread,
        weight: 1.0,
        zDirection: 1,
      },
      { ref: italyDebt.ref, series: italyDebt.series, weight: 0.4, zDirection: 1 },
      { ref: japanDebt.ref, series: japanDebt.series, weight: 0.4, zDirection: 1 },
      { ref: canadaDebt.ref, series: canadaDebt.series, weight: 0.3, zDirection: 1 },
      { ref: ukDebt.ref, series: ukDebt.series, weight: 0.3, zDirection: 1 },
    ],
    triggerDesc:
      "A widening Italy-Germany spread (the classic eurozone fragmentation gauge) alongside simultaneous UK gilt, French OAT, Japanese JGB and Canadian weakness would indicate broad-based, not idiosyncratic, developed-market sovereign stress — the full G7 ex-US picture, not a single country's move.",
    transmissionMechanism:
      "Widening peripheral-vs-core spreads raise refinancing costs for the most indebted sovereigns, pressure domestic banks holding that sovereign's debt (the banking-sovereign 'doom loop'), and can force ECB/central-bank intervention.",
    amplifiers: ["A rating-agency outlook downgrade on a peripheral issuer", "Weak auction demand at a peripheral-sovereign auction (not yet tracked)", "Simultaneous stress in the US Treasury engine"],
    invalidationConditions: ["BTP-Bund spread compresses back toward its trailing median", "Peripheral auction demand remains solid"],
    confirmationConditions: ["Sovereign CDS widens (not yet tracked — Phase 2)", "A credit-rating action confirms the market move"],
    notYetHappened: ["No confirmed disorderly widening in the BTP-Bund spread beyond its trailing range"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });

  return result;
}

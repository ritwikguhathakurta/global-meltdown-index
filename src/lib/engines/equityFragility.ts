import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runEquityFragilityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [vix, sp500, nasdaq, russell] = await Promise.all([
    buildIndicator(ctx.db, "vol.vix", "VIX", "leading", "daily", "index"),
    buildIndicator(ctx.db, "equity.sp500", "S&P 500", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "equity.nasdaq_composite", "Nasdaq Composite", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "equity.russell2000", "Russell 2000", "leading", "daily", "index"),
  ]);

  return composeEngineResult({
    engineKey: "equity_fragility",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["RESILIENT", "STABLE", "FRAGILE", "STRESSED", "DISORDERLY"],
    inputs: [
      { ref: vix.ref, series: vix.series, weight: 1.2, zDirection: 1 },
      { ref: sp500.ref, series: sp500.series, weight: 0.6, zDirection: -1 },
      { ref: nasdaq.ref, series: nasdaq.series, weight: 0.5, zDirection: -1 },
      { ref: russell.ref, series: russell.series, weight: 0.8, zDirection: -1 },
    ],
    triggerDesc:
      "Small-cap (Russell 2000) underperformance versus large-cap indices alongside rising VIX has historically been an early breadth-deterioration signal ahead of broader equity drawdowns.",
    transmissionMechanism:
      "Rising realized/implied volatility raises margin requirements and can trigger systematic (vol-targeting, risk-parity) deleveraging, amplifying initial price moves.",
    amplifiers: ["High market concentration in a handful of mega-cap names (not yet scored — Phase 2)", "Elevated margin debt (not yet tracked — Phase 2)", "Negative dealer gamma positioning (not yet tracked — Phase 2)"],
    invalidationConditions: ["VIX reverts toward its trailing median", "Breadth (small-cap participation) improves alongside large-cap indices"],
    confirmationConditions: ["Market-concentration (top-10 weight) continues rising", "Options skew steepens materially"],
    notYetHappened: ["No confirmed breadth collapse across the tracked indices"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

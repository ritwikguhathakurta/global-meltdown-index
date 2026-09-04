import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runBankingEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [delinquency, chargeoff, creDelinquency, deposits] = await Promise.all([
    buildIndicator(ctx.db, "banking.delinquency_rate_all_loans", "Delinquency Rate, All Loans (All Commercial Banks)", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.chargeoff_rate_all_loans", "Charge-off Rate, All Loans (All Commercial Banks)", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.cre_delinquency_rate", "CRE Loan Delinquency Rate", "leading", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.deposits_total", "Total Deposits, All Commercial Banks", "coincident", "weekly", "USD bn"),
  ]);

  return composeEngineResult({
    engineKey: "banking",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["WELL_CAPITALIZED", "STABLE", "TIGHTENING", "ASSET_QUALITY_STRESS", "SYSTEMIC_BANK_STRESS"],
    inputs: [
      { ref: delinquency.ref, series: delinquency.series, weight: 0.9, zDirection: 1 },
      { ref: chargeoff.ref, series: chargeoff.series, weight: 0.8, zDirection: 1 },
      { ref: creDelinquency.ref, series: creDelinquency.series, weight: 1.0, zDirection: 1 },
      { ref: deposits.ref, series: deposits.series, weight: 0.6, zDirection: -1 },
    ],
    triggerDesc:
      "CRE loan delinquencies are the earliest-moving of these four series historically (regional/CRE exposure concentrates before broad-loan-book delinquency confirms), so a rise there ahead of the other three is the leading signal to watch, not confirmation.",
    transmissionMechanism:
      "Rising delinquencies force higher loan-loss provisions, eroding bank capital and earnings, which tightens lending standards economy-wide; a simultaneous deposit outflow compounds this by forcing asset sales (often at a loss) to meet funding needs.",
    amplifiers: [
      "Concentrated regional-bank CRE exposure (not broken out by bank size in this free dataset — Phase 2)",
      "Uninsured deposit share (not yet tracked — Phase 2, requires FDIC call-report data)",
      "Simultaneous securities mark-to-market losses on rising long-end yields",
    ],
    invalidationConditions: ["CRE delinquency rate stabilizes or declines", "Deposit levels stabilize or grow"],
    confirmationConditions: ["Delinquency/charge-off rates confirm the CRE move with a lag", "Loan growth (not yet tracked) decelerates sharply"],
    notYetHappened: ["No confirmed systemic deposit-flight pattern in the tracked aggregate deposit series"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runBankingEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [delinquency, chargeoff, creDelinquency, deposits, ecbRate, ukRate] = await Promise.all([
    buildIndicator(ctx.db, "banking.delinquency_rate_all_loans", "Delinquency Rate, All Loans (US Commercial Banks)", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.chargeoff_rate_all_loans", "Charge-off Rate, All Loans (US Commercial Banks)", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.cre_delinquency_rate", "CRE Loan Delinquency Rate (US)", "leading", "quarterly", "%"),
    buildIndicator(ctx.db, "banking.deposits_total", "Total Deposits, US Commercial Banks", "coincident", "weekly", "USD bn"),
    buildIndicator(ctx.db, "rate.ecb_deposit_facility", "ECB Deposit Facility Rate (Euro-area bank funding cost)", "leading", "daily", "%"),
    buildIndicator(ctx.db, "rate.uk_short_term", "UK Short-Term Rate (bank funding cost)", "leading", "monthly", "%"),
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
      { ref: ecbRate.ref, series: ecbRate.series, weight: 0.4, zDirection: 1 },
      { ref: ukRate.ref, series: ukRate.series, weight: 0.3, zDirection: 1 },
    ],
    triggerDesc:
      "CRE loan delinquencies are the earliest-moving of these series historically (regional/CRE exposure concentrates before broad-loan-book delinquency confirms), so a rise there ahead of the others is the leading signal to watch, not confirmation.",
    transmissionMechanism:
      "Rising delinquencies force higher loan-loss provisions, eroding bank capital and earnings, which tightens lending standards economy-wide; a simultaneous deposit outflow compounds this by forcing asset sales (often at a loss) to meet funding needs. Elevated Euro-area/UK policy rates raise European bank funding costs in parallel, compressing net interest margins if not passed through to loan pricing.",
    amplifiers: [
      "Concentrated regional-bank CRE exposure (not broken out by bank size in this free dataset — Phase 2)",
      "Uninsured deposit share (not yet tracked — Phase 2, requires FDIC call-report data)",
      "Simultaneous securities mark-to-market losses on rising long-end yields",
      "No free source exists for non-US G7 bank-level NPL/delinquency data (Bank of England, ECB, Bank of Canada, BOJ all publish this behind their own statistical portals, not a common free API) — this engine tracks European/UK funding-cost context only, not asset-quality data, outside the US",
    ],
    invalidationConditions: ["CRE delinquency rate stabilizes or declines", "Deposit levels stabilize or grow"],
    confirmationConditions: ["Delinquency/charge-off rates confirm the CRE move with a lag", "Loan growth (not yet tracked) decelerates sharply"],
    notYetHappened: ["No confirmed systemic deposit-flight pattern in the tracked aggregate deposit series"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Financial-infrastructure cyber/outage engine (V3 §30). Scoped to what a
 * free, official source can actually confirm: each major cloud provider's
 * own published status-page activity. This is a coincident "how much
 * incident activity is happening right now" proxy, not a severity or
 * root-cause classification — see cloudStatus.ts for why raw item-count
 * was chosen over any editorialized score.
 */
export async function runCyberEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [aws, azure, gcp] = await Promise.all([
    buildIndicator(ctx.db, "cyber.aws_status_events_7d", "AWS Status Events (trailing 7d)", "coincident", "daily", "events"),
    buildIndicator(ctx.db, "cyber.azure_status_events_7d", "Azure Status Events (trailing 7d)", "coincident", "daily", "events"),
    buildIndicator(ctx.db, "cyber.gcp_status_events_7d", "Google Cloud Status Events (trailing 7d)", "coincident", "daily", "events"),
  ]);

  return composeEngineResult({
    engineKey: "cyber_infrastructure",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["NOMINAL", "ROUTINE_ACTIVITY", "ELEVATED_ACTIVITY", "MAJOR_INCIDENT", "MULTI_PROVIDER_OUTAGE"],
    inputs: [
      { ref: aws.ref, series: aws.series, weight: 1.0, zDirection: 1 },
      { ref: azure.ref, series: azure.series, weight: 1.0, zDirection: 1 },
      { ref: gcp.ref, series: gcp.series, weight: 1.0, zDirection: 1 },
    ],
    triggerDesc:
      "A simultaneous spike in status-page activity across more than one major provider (rather than one provider's routine maintenance/minor-incident noise) is the pattern that would indicate a systemically relevant infrastructure event rather than an isolated one.",
    transmissionMechanism:
      "Major financial institutions, exchanges and payment processors depend heavily on a small number of cloud providers; a major outage at one can simultaneously disrupt trading, clearing, or payment systems across many unrelated institutions that share the same underlying dependency.",
    amplifiers: ["Confirmed outage at a major exchange or payment processor during the same window (not tracked — no free structured source)", "Multi-provider correlation (two or more providers affected simultaneously)"],
    invalidationConditions: ["Status-page activity returns to its routine baseline", "No confirmed multi-provider correlation"],
    confirmationConditions: ["An affected provider's own incident report confirms customer-facing impact (this engine only counts status-page item volume, not severity)"],
    notYetHappened: ["No confirmed multi-provider simultaneous outage detected in the tracked status feeds"],
    contradictoryEvidence: ["Status-page item counts include routine maintenance notices, not only incidents — this is a noisy proxy by construction"],
    methodologyVersion: "v0.1-freedata",
  });
}

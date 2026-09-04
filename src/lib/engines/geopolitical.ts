import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Uses the Caldara-Iacoviello Geopolitical Risk Index — automated text-search
 * counts of geopolitical-risk coverage across 10 major newspapers, published
 * monthly, methodologically transparent and free. Not sensational social
 * media, not our own editorializing (V3 §26 requirement). GPRT (threats) is
 * classified leading, GPRA (realized acts) coincident — the source itself
 * distinguishes these two, which is exactly the leading/coincident split V3
 * asks for.
 */
export async function runGeopoliticalEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [gpr, gprThreats, gprActs] = await Promise.all([
    buildIndicator(ctx.db, "geopolitical.gpr_index", "Geopolitical Risk Index (overall)", "coincident", "monthly", "index"),
    buildIndicator(ctx.db, "geopolitical.gpr_threats", "Geopolitical Threats Sub-Index", "leading", "monthly", "index"),
    buildIndicator(ctx.db, "geopolitical.gpr_acts", "Geopolitical Acts Sub-Index", "lagging", "monthly", "index"),
  ]);

  return composeEngineResult({
    engineKey: "geopolitical",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["QUIET", "ELEVATED_CHATTER", "ESCALATING", "ACTIVE_CRISIS", "SYSTEMIC_SHOCK"],
    inputs: [
      { ref: gpr.ref, series: gpr.series, weight: 0.7, zDirection: 1 },
      { ref: gprThreats.ref, series: gprThreats.series, weight: 1.0, zDirection: 1 },
      { ref: gprActs.ref, series: gprActs.series, weight: 0.6, zDirection: 1 },
    ],
    triggerDesc:
      "The Threats sub-index rising while the Acts sub-index has not yet followed is the leading pattern to watch (escalatory rhetoric/mobilization ahead of a realized event); Acts confirming after Threats has already risen is the coincident-confirmation pattern.",
    transmissionMechanism:
      "Geopolitical escalation transmits to markets primarily through energy-price shocks, shipping/trade disruption, sanctions-driven capital-flow restrictions, and a general risk-off repricing of risk premia across asset classes.",
    amplifiers: ["A confirmed energy-shipping-lane disruption (see Energy engine)", "Simultaneous sanctions action against a systemically important economy", "A cyber component to the escalation (see Cyber engine)"],
    invalidationConditions: ["The Threats sub-index declines back toward its trailing median", "No confirmed escalation into the Acts sub-index despite elevated Threats"],
    confirmationConditions: ["Acts sub-index rises to confirm the Threats move", "Energy prices or shipping rates move in tandem"],
    notYetHappened: ["No confirmed acceleration from Threats into realized Acts beyond the trailing pattern"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}

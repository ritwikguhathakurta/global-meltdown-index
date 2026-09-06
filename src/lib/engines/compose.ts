import type { IndicatorRef, Horizon, EngineResult } from "./types";
import type { Point } from "../metrics/stats";
import { zScore, zToRiskScore, changeOverDays } from "../metrics/stats";
import { ZSCORE_WINDOW_BY_HORIZON, CLASSIFICATION_WEIGHT_BY_HORIZON, computeConfidence } from "./horizon";

export type WeightedIndicator = {
  ref: IndicatorRef;
  series: Point[];
  weight: number;
  /** 1 = higher raw value means higher risk; -1 = lower raw value means higher risk. */
  zDirection: 1 | -1;
};

export type ComposeInput = {
  engineKey: string;
  asOf: string;
  horizon: Horizon;
  regimeLabels: [string, string, string, string, string]; // for score bands 0-20,20-40,40-60,60-80,80-100
  inputs: WeightedIndicator[];
  triggerDesc: string;
  transmissionMechanism: string;
  amplifiers: string[];
  invalidationConditions: string[];
  confirmationConditions: string[];
  notYetHappened: string[];
  contradictoryEvidence: string[];
  methodologyVersion: string;
};

function regimeFor(score: number, labels: [string, string, string, string, string]): string {
  if (score < 20) return labels[0];
  if (score < 40) return labels[1];
  if (score < 60) return labels[2];
  if (score < 80) return labels[3];
  return labels[4];
}

export function composeEngineResult(input: ComposeInput): EngineResult {
  const usable = input.inputs.filter((i) => i.ref.status !== "UNAVAILABLE" && i.series.length >= 20);
  const { confidence, dataCompleteness } = computeConfidence(
    usable.map((i) => i.ref.status),
    input.inputs.length,
    input.horizon
  );

  const window = ZSCORE_WINDOW_BY_HORIZON[input.horizon];
  const classWeight = CLASSIFICATION_WEIGHT_BY_HORIZON[input.horizon];
  const componentScores: { key: string; label: string; score: number; weight: number }[] = [];
  for (const w of usable) {
    const z = zScore(w.series, window);
    const s = zToRiskScore(z, w.zDirection);
    if (s !== null) {
      const weight = w.weight * classWeight[w.ref.classification];
      componentScores.push({ key: w.ref.key, label: w.ref.label, score: s, weight });
    }
  }

  const totalWeight = componentScores.reduce((a, b) => a + b.weight, 0);
  const score =
    componentScores.length > 0 && totalWeight > 0
      ? Math.round(componentScores.reduce((a, b) => a + b.score * b.weight, 0) / totalWeight)
      : null;

  const topDrivers = [...componentScores]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, 5)
    .map((c) => ({ key: c.key, label: c.label, contribution: c.score }));

  let direction: EngineResult["direction"] = "unknown";
  const directionalDeltas = usable
    .map((w) => {
      const d = changeOverDays(w.series, 20);
      return d === null ? null : d * w.zDirection;
    })
    .filter((d): d is number => d !== null);
  if (directionalDeltas.length > 0) {
    const avgDelta = directionalDeltas.reduce((a, b) => a + b, 0) / directionalDeltas.length;
    direction = Math.abs(avgDelta) < 1e-9 ? "stable" : avgDelta > 0 ? "deteriorating" : "improving";
  }

  const leadingIndicators = input.inputs.filter((i) => i.ref.classification === "leading").map((i) => i.ref);
  const coincidentIndicators = input.inputs.filter((i) => i.ref.classification === "coincident").map((i) => i.ref);
  const laggingIndicators = input.inputs.filter((i) => i.ref.classification === "lagging").map((i) => i.ref);

  return {
    engineKey: input.engineKey,
    asOf: input.asOf,
    horizon: input.horizon,
    score,
    direction,
    regime: score === null ? "INSUFFICIENT_DATA" : regimeFor(score, input.regimeLabels),
    confidence,
    topDrivers,
    leadingIndicators,
    coincidentIndicators,
    laggingIndicators,
    contradictoryEvidence: input.contradictoryEvidence,
    notYetHappened: input.notYetHappened,
    triggerDesc: input.triggerDesc,
    amplifiers: input.amplifiers,
    transmissionMechanism: input.transmissionMechanism,
    invalidationConditions: input.invalidationConditions,
    confirmationConditions: input.confirmationConditions,
    dataCompleteness,
    methodologyVersion: input.methodologyVersion,
  };
}

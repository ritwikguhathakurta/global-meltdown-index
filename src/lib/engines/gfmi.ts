import type { EngineResult } from "./types";

/**
 * GFMI composite (V3 §2, §33, §67). Weighted average of engine scores plus a
 * nonlinear multi-shock amplifier: when several independent engines are
 * simultaneously elevated (score > 60), the composite gets bumped above the
 * plain weighted average, since correlated stress across independent risk
 * dimensions is empirically more dangerous than any single elevated reading.
 *
 * Only Phase-1 engines (freely-sourced) currently feed this composite — see
 * `components` in the output for exactly which engines were included and
 * their individual weights, so the score is auditable rather than a black box.
 */

export type GfmiInput = { engineKey: string; score: number | null; confidence: number; weight: number };

const REGIME_BANDS: [number, string][] = [
  [15, "LOW_SYSTEMIC_RISK"],
  [30, "WATCH"],
  [45, "VULNERABILITY_BUILDING"],
  [60, "HIGH_SYSTEMIC_RISK"],
  [75, "CRISIS_DEVELOPING"],
  [90, "MAJOR_DELEVERAGING"],
  [101, "SYSTEMIC_CRISIS"],
];

function regimeForScore(score: number): string {
  for (const [ceiling, label] of REGIME_BANDS) {
    if (score < ceiling) return label;
  }
  return "SYSTEMIC_CRISIS";
}

export function computeGfmi(inputs: GfmiInput[], vix: number | null, creditStress: number | null) {
  const usable = inputs.filter((i) => i.score !== null);
  if (usable.length === 0) {
    return {
      score: null as number | null,
      regime: "INSUFFICIENT_DATA",
      confidence: 0,
      components: {},
      amplifierApplied: 1,
      overrideTriggered: null as string | null,
    };
  }

  const totalWeight = usable.reduce((a, b) => a + b.weight, 0);
  const weightedAvg = usable.reduce((a, b) => a + (b.score as number) * b.weight, 0) / totalWeight;

  const elevatedCount = usable.filter((i) => (i.score as number) >= 60).length;
  const amplifier = elevatedCount >= 2 ? 1 + Math.min(0.06 * (elevatedCount - 1), 0.25) : 1;

  const rawComposite = Math.min(100, weightedAvg * amplifier);
  const score = Math.round(rawComposite);
  const confidence =
    Math.round((usable.reduce((a, b) => a + b.confidence * b.weight, 0) / totalWeight) * 100) / 100;

  let overrideTriggered: string | null = null;
  if (score > 90) {
    overrideTriggered = "SYSTEMIC_CRISIS_REGIME";
  } else if (score > 75 && vix !== null && vix > 35 && creditStress !== null && creditStress > 70) {
    overrideTriggered = "GLOBAL_DELEVERAGING_REGIME";
  }

  const components = Object.fromEntries(
    usable.map((i) => [
      i.engineKey,
      { score: i.score, weight: i.weight, contribution: Math.round(((i.score as number) * i.weight) / totalWeight * 100) / 100 },
    ])
  );

  return {
    score,
    regime: overrideTriggered ?? regimeForScore(score),
    confidence,
    components,
    amplifierApplied: Math.round(amplifier * 1000) / 1000,
    overrideTriggered,
  };
}

export function engineResultToGfmiInput(result: EngineResult, weight: number): GfmiInput {
  return { engineKey: result.engineKey, score: result.score, confidence: result.confidence, weight };
}

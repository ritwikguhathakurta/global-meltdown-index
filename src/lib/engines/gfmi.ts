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

/**
 * 7-stage named progression over the exact same 0-100 composite score and
 * band thresholds as REGIME_BANDS above (15/30/45/60/75/90) — same numbers
 * this file already used, just given stage numbers, short labels, and a
 * description so the dashboard can show a stepper instead of a bare regime
 * string. Mirrors the per-country crisis-stage model in emDebtRegime.ts.
 */
export type GfmiStageKey =
  | "LOW_SYSTEMIC_RISK"
  | "WATCH"
  | "VULNERABILITY_BUILDING"
  | "HIGH_SYSTEMIC_RISK"
  | "CRISIS_DEVELOPING"
  | "MAJOR_DELEVERAGING"
  | "SYSTEMIC_CRISIS";

export type GfmiStageDef = {
  stage: number; // 1-7
  key: GfmiStageKey;
  label: string;
  shortLabel: string;
  description: string;
};

export const GFMI_STAGES: GfmiStageDef[] = [
  {
    stage: 1,
    key: "LOW_SYSTEMIC_RISK",
    label: "Stage 1 — Low Systemic Risk",
    shortLabel: "Low Risk",
    description: "Tracked engines are broadly calm; no material multi-shock amplification is being applied.",
  },
  {
    stage: 2,
    key: "WATCH",
    label: "Stage 2 — Watch",
    shortLabel: "Watch",
    description: "Some deterioration is showing up across tracked engines, but it is not yet broad-based.",
  },
  {
    stage: 3,
    key: "VULNERABILITY_BUILDING",
    label: "Stage 3 — Vulnerability Building",
    shortLabel: "Vulnerability Building",
    description: "Structural vulnerabilities are building across more than one engine at once.",
  },
  {
    stage: 4,
    key: "HIGH_SYSTEMIC_RISK",
    label: "Stage 4 — High Systemic Risk",
    shortLabel: "High Risk",
    description: "Multiple independent risk dimensions are elevated together — the point where the composite's multi-shock amplifier typically starts to engage, since correlated stress across independent engines is empirically more dangerous than any one elevated reading.",
  },
  {
    stage: 5,
    key: "CRISIS_DEVELOPING",
    label: "Stage 5 — Crisis Developing",
    shortLabel: "Crisis Developing",
    description: "Broad, correlated deterioration across engines; the amplifier is meaningfully lifting the composite above the plain weighted average of its parts.",
  },
  {
    stage: 6,
    key: "MAJOR_DELEVERAGING",
    label: "Stage 6 — Major Deleveraging",
    shortLabel: "Major Deleveraging",
    description: "Severe, correlated stress across tracked engines, consistent with a broad deleveraging episode — this is also the band where the GLOBAL_DELEVERAGING_REGIME override (VIX + credit stress both extreme) can trigger.",
  },
  {
    stage: 7,
    key: "SYSTEMIC_CRISIS",
    label: "Stage 7 — Systemic Crisis",
    shortLabel: "Systemic Crisis",
    description: "The top of the observed range on this composite's 0-100 scale. This is a score band, not a declared historical crisis — it reflects how broadly and severely the tracked free-data engines are reading right now, nothing more.",
  },
];

export function gfmiStageForScore(score: number | null): GfmiStageDef | null {
  if (score === null) return null;
  for (let i = 0; i < REGIME_BANDS.length; i++) {
    if (score < REGIME_BANDS[i][0]) return GFMI_STAGES[i];
  }
  return GFMI_STAGES[GFMI_STAGES.length - 1];
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

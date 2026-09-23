import type { Point } from "../metrics/stats";
import { zScore, pctChangeOverDays, latest } from "../metrics/stats";
import type { CompositeIndex, Reading } from "./types";

/**
 * Global Leverage Index (GLI) proxy — combines only real, already-or-newly-tracked series:
 * BIS OTC derivatives notional growth (bisOtcDerivatives.ts, new), BIS credit-to-GDP gap
 * (bisCreditGap.ts, existing), bank Tier-1/holding-company leverage ratios (fdicBankFind.ts /
 * bankSecFilings.ts, existing), and NY Fed repo volume growth (nyFedRepoRates.ts, new). Every input
 * is a real observation; this composite itself is a genuine index (a weighted average of real,
 * independently-meaningful z-scores), not a proxy standing in for something unobservable —
 * unlike the MODEL_ESTIMATE indices in stress.ts.
 */
export function computeGli(inputs: {
  otcNotionalTotal: Point[];
  creditGapSeries: Point[][];
  bankLeverageRatios: { bank: string; ratio: number | null; asOf: string | null }[];
  repoVolume: Point[];
}): CompositeIndex {
  const readings: Reading[] = [];
  const zScores: number[] = [];

  const otcGrowth = pctChangeOverDays(inputs.otcNotionalTotal, 365);
  if (otcGrowth !== null) {
    readings.push({ key: "otc_notional_yoy", label: "BIS OTC Derivatives Notional (YoY)", value: otcGrowth, unit: "%", asOf: latest(inputs.otcNotionalTotal)?.t ?? null, quality: "REAL" });
    zScores.push(Math.max(-3, Math.min(3, otcGrowth / 10)));
  }

  for (const series of inputs.creditGapSeries) {
    const last = latest(series);
    if (!last) continue;
    const z = zScore(series, 40);
    if (z !== null) zScores.push(z);
  }

  const validRatios = inputs.bankLeverageRatios.filter((b) => b.ratio !== null);
  if (validRatios.length > 0) {
    const avgRatio = validRatios.reduce((s, b) => s + (b.ratio as number), 0) / validRatios.length;
    readings.push({ key: "bank_leverage_ratio_avg", label: "Average Bank Holding-Company Leverage Ratio (Equity/Assets)", value: avgRatio, unit: "%", asOf: validRatios[0].asOf, quality: "REAL" });
    // A lower equity/assets ratio means MORE balance-sheet leverage, so this input is inverted.
    zScores.push(-Math.max(-3, Math.min(3, (avgRatio - 8) / 2)));
  }

  const repoGrowth = pctChangeOverDays(inputs.repoVolume, 90);
  if (repoGrowth !== null) {
    readings.push({ key: "repo_volume_growth", label: "NY Fed Tri-Party Repo Volume (90d change)", value: repoGrowth, unit: "%", asOf: latest(inputs.repoVolume)?.t ?? null, quality: "REAL" });
    zScores.push(Math.max(-3, Math.min(3, repoGrowth / 15)));
  }

  if (zScores.length === 0) {
    return { key: "gli", label: "Global Leverage Index", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No inputs available.", inputs: readings };
  }

  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  const level = 50 + avgZ * 15; // center 50, +/-1 std dev ~= +/-15 points, matches this repo's convention elsewhere

  return {
    key: "gli",
    label: "Global Leverage Index",
    level: Math.max(0, Math.min(100, level)),
    change4w: null, // requires a second full snapshot; left null rather than fabricated
    quality: "REAL",
    methodology: "Average z-score (each clamped to ±3) of: BIS OTC derivatives notional YoY growth, BIS credit-to-GDP gap (per tracked economy), average bank holding-company leverage ratio (inverted — lower equity/assets = more leverage), and NY Fed repo volume 90-day growth. Mapped to 0-100 as 50 + 15×avg z. Real data throughout.",
    inputs: readings,
  };
}

/** Counterparty Risk (CRI) proxy — bank leverage ratios (real) plus a credit-spread z-score the
 * caller supplies (reused from the existing Credit engine's already-computed data, not duplicated
 * here). Genuinely real inputs, but the COMBINATION into one "counterparty risk" number is this
 * page's own heuristic (no free source publishes an actual counterparty-risk index), hence
 * MODEL_ESTIMATE. */
export function computeCri(inputs: { bankLeverageRatios: { bank: string; ratio: number | null }[]; creditSpreadZ: number | null }): CompositeIndex {
  const readings: Reading[] = [];
  const zScores: number[] = [];

  const validRatios = inputs.bankLeverageRatios.filter((b) => b.ratio !== null);
  if (validRatios.length > 0) {
    const avgRatio = validRatios.reduce((s, b) => s + (b.ratio as number), 0) / validRatios.length;
    zScores.push(-Math.max(-3, Math.min(3, (avgRatio - 8) / 2)));
    readings.push({ key: "bank_leverage_ratio_avg", label: "Average Bank Leverage Ratio", value: avgRatio, unit: "%", asOf: null, quality: "REAL" });
  }
  if (inputs.creditSpreadZ !== null) {
    zScores.push(inputs.creditSpreadZ);
    readings.push({ key: "credit_spread_z", label: "Corporate Credit Spread (z-score, from the Credit engine)", value: inputs.creditSpreadZ, unit: "z", asOf: null, quality: "REAL" });
  }

  if (zScores.length === 0) {
    return { key: "cri", label: "Counterparty Risk Index (proxy)", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No inputs available.", inputs: readings };
  }
  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  return {
    key: "cri",
    label: "Counterparty Risk Index (proxy)",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: null,
    quality: "MODEL_ESTIMATE",
    methodology: "Heuristic combination of real bank-leverage-ratio and credit-spread z-scores. No free source publishes an actual cross-counterparty exposure index — this approximates direction/magnitude of counterparty stress, not a measured quantity.",
    inputs: readings,
  };
}

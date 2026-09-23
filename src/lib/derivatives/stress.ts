import type { Point } from "../metrics/stats";
import { zScore, latest, changeOverDays } from "../metrics/stats";
import type { CompositeIndex, LeverageRegime, Reading } from "./types";

/**
 * MSI / CSI / FDR / DLS — spec sections 35-37 (Margin Stress), 38-40 (Collateral Stress),
 * §6 forced-deleveraging risk, and §109 (Derivatives Liquidity Score) ask for indices built from
 * real margin calls, collateral haircuts and dealer inventory data. None of that is published free
 * anywhere (confirmed during planning — see docs/DERIVATIVES_ENGINE.md). Rather than not
 * showing anything, or worse, inventing margin/collateral numbers, each of these is built as an
 * explicitly labeled MODEL_ESTIMATE heuristic from real proxies only: volatility level/change (VIX,
 * MOVE), repo-rate dispersion (a real, if imperfect, collateral-scarcity signal — a widening
 * 99th-1st percentile spread on tri-party repo means some borrowers are paying up for collateral),
 * and positioning crowding (from positioning.ts, real). Every card built from these MUST render the
 * "MODEL ESTIMATE — not a real margin/collateral number" badge; nothing here should ever be
 * captioned as if it were an actual margin-call or haircut figure.
 */
function clampZ(z: number | null): number {
  return z === null ? 0 : Math.max(-3, Math.min(3, z));
}

function volatilityStressReading(label: string, series: Point[]): { z: number | null; reading: Reading } {
  const last = latest(series);
  const z = zScore(series, 252);
  return {
    z,
    reading: { key: label.toLowerCase().replace(/\s+/g, "_"), label, value: last?.v ?? null, unit: "index", asOf: last?.t ?? null, quality: last ? "REAL" : "UNAVAILABLE" },
  };
}

export function computeMsi(inputs: { vix: Point[]; move: Point[]; positioningLevel: number | null }): CompositeIndex {
  const vixR = volatilityStressReading("VIX", inputs.vix);
  const moveR = volatilityStressReading("MOVE Index", inputs.move);
  const zScores = [vixR.z, moveR.z].map(clampZ).filter((_z, i) => [vixR.z, moveR.z][i] !== null);
  if (inputs.positioningLevel !== null) zScores.push(clampZ((inputs.positioningLevel - 20) / 20));

  const readings = [vixR.reading, moveR.reading];
  if (zScores.length === 0) {
    return { key: "msi", label: "Margin Stress Index (proxy)", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No inputs available.", inputs: readings };
  }
  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  return {
    key: "msi",
    label: "Margin Stress Index (proxy)",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: changeOverDays(inputs.vix, 28),
    quality: "MODEL_ESTIMATE",
    methodology: "No free source publishes real margin-call or margin-requirement data. This heuristic combines equity (VIX) and rates (MOVE) implied-volatility z-scores with the Positioning Crowding Index level — real proxies for conditions that historically precede margin increases, not a measurement of margin itself.",
    inputs: readings,
  };
}

export function computeCsi(inputs: { repoDispersion: Point[]; repoVolumeChange: number | null }): CompositeIndex {
  const last = latest(inputs.repoDispersion);
  const z = zScore(inputs.repoDispersion, 252);
  const readings: Reading[] = [
    { key: "repo_dispersion", label: "SOFR 99th-1st Percentile Spread", value: last?.v ?? null, unit: "pp", asOf: last?.t ?? null, quality: last ? "REAL" : "UNAVAILABLE" },
  ];
  if (z === null) {
    return { key: "csi", label: "Collateral Stress Index (proxy)", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No inputs available.", inputs: readings };
  }
  const zScores = [clampZ(z)];
  if (inputs.repoVolumeChange !== null) zScores.push(clampZ(inputs.repoVolumeChange / 10));
  const avgZ = zScores.reduce((s, v) => s + v, 0) / zScores.length;
  return {
    key: "csi",
    label: "Collateral Stress Index (proxy)",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: null,
    quality: "MODEL_ESTIMATE",
    methodology: "No free source publishes real collateral-haircut or collateral-availability data. This heuristic uses the SOFR percentile-band dispersion (a widening spread between the 99th and 1st percentile of tri-party repo rates is a real, published signal that some borrowers are paying up for scarce collateral) and repo volume change — a proxy for collateral scarcity, not a direct measurement of it.",
    inputs: readings,
  };
}

/** Forced-Deleveraging Risk / Derivatives Liquidity Stress — both further-derived heuristics
 * (MSI/CSI stacked with positioning crowding), so both are MODEL_ESTIMATE by construction; kept
 * separate from MSI/CSI because the spec asks for them as distinct outputs (§6, §109), not because
 * either has its own independent real data. */
export function computeFdrAndDls(msi: CompositeIndex, csi: CompositeIndex, pci: CompositeIndex): { fdr: CompositeIndex; dls: CompositeIndex } {
  const levels = [msi.level, csi.level, pci.level].filter((l): l is number => l !== null);
  const fdrLevel = levels.length > 0 ? levels.reduce((s, l) => s + l, 0) / levels.length : null;
  const dlsLevel = msi.level !== null && csi.level !== null ? (msi.level + csi.level) / 2 : null;
  return {
    fdr: {
      key: "fdr",
      label: "Forced Deleveraging Risk (proxy)",
      level: fdrLevel,
      change4w: null,
      quality: levels.length > 0 ? "MODEL_ESTIMATE" : "UNAVAILABLE",
      methodology: "Average of the Margin Stress, Collateral Stress and Positioning Crowding proxy levels. A further derivative of already-proxied indices — directional signal only, not a forced-selling forecast.",
      inputs: [],
    },
    dls: {
      key: "dls",
      label: "Derivatives Liquidity Stress (proxy)",
      level: dlsLevel,
      change4w: null,
      quality: dlsLevel !== null ? "MODEL_ESTIMATE" : "UNAVAILABLE",
      methodology: "Average of the Margin Stress and Collateral Stress proxy levels. No free source publishes real bid/ask, market-depth or dealer-inventory data for derivatives markets (spec §109) — this is a funding/volatility-based stand-in, not a liquidity measurement.",
      inputs: [],
    },
  };
}

/** CALCI (Cross-Asset Leverage Contagion) and the Global Leverage Regime label — a small
 * dependency-graph combination (leverage -> margin-proxy -> liquidity, spec §121), not a flat
 * average: GLI sets the base leverage level, MSI/CSI raise it only when they are ALSO elevated
 * (the "same reading of 70 means different things depending on whether margin/liquidity are also
 * stressed" principle from spec §148). */
export function computeCalciAndRegime(gli: CompositeIndex, msi: CompositeIndex, csi: CompositeIndex, pci: CompositeIndex): { calci: CompositeIndex; regime: LeverageRegime } {
  const base = gli.level ?? 50;
  const stressLevels = [msi.level, csi.level].filter((l): l is number => l !== null);
  const avgStress = stressLevels.length > 0 ? stressLevels.reduce((s, l) => s + l, 0) / stressLevels.length : 50;
  // Amplify base leverage by how far stress is above/below neutral (50), rather than averaging them
  // flatly — this is the "leverage building while liquidity also deteriorates gets materially
  // higher treatment than leverage alone" behavior the spec explicitly asks for.
  const amplification = (avgStress - 50) / 50; // -1..+1
  const level = Math.max(0, Math.min(100, base * (1 + 0.4 * amplification)));

  let regime: LeverageRegime = "NORMAL";
  const crowded = (pci.level ?? 0) >= 50;
  if (level < 25) regime = "LOW_LEVERAGE";
  else if (level < 45) regime = "NORMAL";
  else if (level < 60) regime = crowded ? "CROWDED" : "BUILDING";
  else if (level < 75) regime = "HIGH";
  else if (avgStress >= 65) regime = "FRAGILE";
  else regime = "HIGH";

  return {
    calci: {
      key: "calci",
      label: "Cross-Asset Leverage Contagion Index",
      level,
      change4w: null,
      quality: gli.quality === "REAL" && stressLevels.length > 0 ? "MODEL_ESTIMATE" : "UNAVAILABLE",
      methodology: "GLI's level, amplified (not averaged) by how far the Margin/Collateral Stress proxies sit above or below neutral — a leverage-→margin-→liquidity dependency chain (spec §121), not a flat weighted sum of independent scores. Inherits MODEL_ESTIMATE status from its margin/collateral inputs.",
      inputs: [],
    },
    regime,
  };
}

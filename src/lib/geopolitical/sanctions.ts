import type { Point } from "../metrics/stats";
import { latest, zScore, changeOverDays } from "../metrics/stats";
import type { CompositeIndex, Reading } from "./types";

/**
 * Sanctions Intensity composite — real, sourced OFAC SDN entity counts per program
 * (ofacSanctions.ts). Real data throughout: these are genuine counts of currently-listed
 * entities, not a fabricated severity score. The z-score needs 20+ daily observations per
 * program to mean anything (this connector only started collecting recently), so this composite
 * degrades gracefully to UNAVAILABLE until enough history accumulates — exactly the same
 * "real data, but too little history yet" case documented for CLAUDE.md's lookback-window note.
 */
export function computeSanctionsIntensity(sdnCountsByProgram: Record<string, Point[]>): CompositeIndex {
  const readings: Reading[] = [];
  const zScores: number[] = [];

  for (const [program, series] of Object.entries(sdnCountsByProgram)) {
    const last = latest(series);
    if (!last) continue;
    const change30d = changeOverDays(series, 30);
    readings.push({
      key: `sdn_${program}`,
      label: `OFAC-listed entities — ${program.replace(/_/g, " ")}`,
      value: last.v,
      unit: "entities",
      asOf: last.t,
      quality: "REAL",
      methodology: change30d !== null ? `${change30d >= 0 ? "+" : ""}${change30d} vs. 30 days ago` : undefined,
    });
    const z = zScore(series, 90);
    if (z !== null) zScores.push(z);
  }

  if (zScores.length === 0) {
    return {
      key: "sanctions_intensity",
      label: "Sanctions Intensity Index",
      level: null,
      change4w: null,
      quality: readings.length > 0 ? "REAL" : "UNAVAILABLE",
      methodology: readings.length > 0
        ? "Real OFAC SDN entity counts by program are shown above, but not enough daily history has accumulated yet to compute a meaningful trend z-score (needs ~90 days)."
        : "No OFAC data available.",
      inputs: readings,
    };
  }

  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  return {
    key: "sanctions_intensity",
    label: "Sanctions Intensity Index",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: null,
    quality: "REAL",
    methodology: "Average z-score (90-day trailing baseline) of OFAC SDN entity counts across tracked sanctions programs (Russia, Iran, North Korea, Cuba, Venezuela, Belarus, Ukraine-related, terrorism, weapons proliferation). Mapped to 0-100 as 50 + 15×avg z. Real data throughout — a rising count reflects genuinely expanding designations, not a fabricated severity weighting.",
    inputs: readings,
  };
}

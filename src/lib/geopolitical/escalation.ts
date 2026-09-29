import type { Point } from "../metrics/stats";
import { latest, zScore } from "../metrics/stats";
import type { CompositeIndex, Reading } from "./types";

/**
 * Escalation Reading — combines real GDELT event-derived signals (gdeltEvents.ts: average
 * Goldstein scale, conflict-event share) with the existing Caldara-Iacoviello GPR Threats
 * sub-index (already tracked by the registered geopolitical engine — reused here, not
 * re-ingested). All REAL, automated-text-derived indicators — explicitly disclosed as such: this
 * is machine event-coding of news text, not verified intelligence, the same caveat GDELT's own
 * documentation carries.
 */
export function computeEscalation(inputs: { avgGoldstein: Point[]; conflictShare: Point[]; gprThreats: Point[] }): CompositeIndex {
  const readings: Reading[] = [];
  const zScores: number[] = [];

  const goldstein = latest(inputs.avgGoldstein);
  if (goldstein) {
    readings.push({ key: "gdelt_goldstein", label: "GDELT Average Goldstein Scale (sampled window)", value: goldstein.v, unit: "index (-10..+10)", asOf: goldstein.t, quality: "REAL", methodology: "Automated event-coding of recent news text — negative values indicate more conflictual coverage, not verified intelligence." });
    const z = zScore(inputs.avgGoldstein, 90);
    // Goldstein is already signed conflict(-)/cooperation(+), so invert for a "higher = more escalation" z.
    if (z !== null) zScores.push(-z);
  }

  const conflictShare = latest(inputs.conflictShare);
  if (conflictShare) {
    readings.push({ key: "gdelt_conflict_share", label: "GDELT Conflict-Event Share (sampled window)", value: conflictShare.v * 100, unit: "%", asOf: conflictShare.t, quality: "REAL" });
    const z = zScore(inputs.conflictShare, 90);
    if (z !== null) zScores.push(z);
  }

  const gprThreats = latest(inputs.gprThreats);
  if (gprThreats) {
    readings.push({ key: "gpr_threats", label: "Geopolitical Risk Threats Sub-Index (Caldara-Iacoviello)", value: gprThreats.v, unit: "index_1985_2019_avg_100", asOf: gprThreats.t, quality: "REAL" });
    const z = zScore(inputs.gprThreats, 120);
    if (z !== null) zScores.push(z);
  }

  if (zScores.length === 0) {
    return { key: "escalation", label: "Escalation Reading", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No inputs with enough history yet.", inputs: readings };
  }

  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  return {
    key: "escalation",
    label: "Escalation Reading",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: null,
    quality: "REAL",
    methodology: "Average z-score of: GDELT Goldstein scale (inverted, 90-day baseline), GDELT conflict-event share (90-day baseline), and the GPR Threats sub-index (120-day baseline). Real automated indicators throughout; GDELT inputs are machine-coded from news text, not verified intelligence.",
    inputs: readings,
  };
}

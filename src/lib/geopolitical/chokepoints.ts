import type { Point } from "../metrics/stats";
import { latest, zScore } from "../metrics/stats";
import type { CompositeIndex, Reading, ChokepointRow } from "./types";

/**
 * Maritime Chokepoint rows and stress composite — reuses IMF PortWatch's existing
 * energy.chokepoint.<slug>.transits_total series (imfPortwatch.ts, already ingested for the
 * Energy engine) rather than re-fetching. Real, AIS-derived daily vessel-transit data, Tier 2.
 * A genuine drop in daily transits through a chokepoint (vs. its own trailing baseline) is a
 * real physical-disruption signal — not narrative, not modeled.
 */
export function buildChokepointRows(inputs: { chokepoints: { slug: string; label: string }[]; transitsBySlug: Record<string, Point[]> }): ChokepointRow[] {
  return inputs.chokepoints.map(({ slug, label }) => {
    const series = inputs.transitsBySlug[slug] ?? [];
    const last = latest(series);
    return {
      slug,
      label,
      transitsPerDay: last?.v ?? null,
      transitsZ: zScore(series, 90),
      asOf: last?.t ?? null,
    };
  });
}

export function computeChokepointStress(rows: ChokepointRow[]): CompositeIndex {
  const readings: Reading[] = [];
  const zScores: number[] = [];

  for (const r of rows) {
    if (r.transitsZ === null) continue;
    readings.push({ key: `${r.slug}_transits_z`, label: `${r.label} daily transits (z-score)`, value: r.transitsZ, unit: "z", asOf: r.asOf, quality: "REAL" });
    // A transit DROP is the stress signal — invert so lower traffic = higher stress reading.
    zScores.push(-r.transitsZ);
  }

  if (zScores.length === 0) {
    return { key: "chokepoint_stress", label: "Maritime Chokepoint Stress", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "Not enough IMF PortWatch history yet.", inputs: readings };
  }

  const avgZ = zScores.reduce((s, z) => s + z, 0) / zScores.length;
  return {
    key: "chokepoint_stress",
    label: "Maritime Chokepoint Stress",
    level: Math.max(0, Math.min(100, 50 + avgZ * 15)),
    change4w: null,
    quality: "REAL",
    methodology: "Average inverted z-score (90-day baseline) of daily vessel transits across tracked IMF PortWatch chokepoints — a real drop in traffic through a chokepoint relative to its own recent history. Real, AIS-derived data throughout.",
    inputs: readings,
  };
}

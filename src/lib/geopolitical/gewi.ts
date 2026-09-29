import type { CompositeIndex, Reading } from "./types";

/**
 * GEWI — Geopolitical Early Warning composite (spec §88). Combines the Military Buildup,
 * Sanctions Intensity, Escalation and Maritime Chokepoint Stress composites (each real). Every
 * INPUT is real; the COMBINATION into one "early warning" number is this page's own heuristic —
 * no free source publishes an actual validated early-warning index, and this repo has no
 * labeled ground truth to validate one against (see docs/GEOPOLITICAL_ENGINE.md's "not built"
 * section on ML backtesting). Hence MODEL_ESTIMATE, the same treatment `computeCri` gives a
 * heuristic combination of otherwise-real inputs in src/lib/derivatives/leverage.ts.
 */
export function computeGewi(components: CompositeIndex[]): CompositeIndex {
  const available = components.filter((c) => c.level !== null);
  const readings: Reading[] = components.map((c) => ({
    key: c.key,
    label: c.label,
    value: c.level,
    unit: "index (0-100)",
    asOf: null,
    quality: c.quality,
    methodology: c.methodology,
  }));

  if (available.length === 0) {
    return { key: "gewi", label: "Geopolitical Early Warning Index (GEWI)", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No component composites available yet.", inputs: readings };
  }

  const avgLevel = available.reduce((s, c) => s + (c.level as number), 0) / available.length;
  return {
    key: "gewi",
    label: "Geopolitical Early Warning Index (GEWI)",
    level: avgLevel,
    change4w: null,
    quality: "MODEL_ESTIMATE",
    methodology: `Simple average of ${available.length} available component composites (Military Buildup, Sanctions Intensity, Escalation, Maritime Chokepoint Stress — each built from real data). The combination itself is a heuristic, not a validated predictive model: no labeled ground truth exists to backtest against, so no precision/recall/lead-time claim is made for this number.`,
    inputs: readings,
  };
}

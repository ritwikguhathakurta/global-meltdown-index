/**
 * Deterministic numerical helpers. The AI/report layer must never eyeball these —
 * every risk-engine calculation routes through here so a given input always
 * produces the same output (V3-A30 numerical-accuracy requirement).
 */

export type Point = { t: string; v: number };

export function latest(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** z-score of the most recent value against its own trailing window (excludes itself from the baseline). */
export function zScore(points: Point[], window = 252): number | null {
  if (points.length < 20) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const current = sorted[sorted.length - 1];
  const baseline = sorted.slice(Math.max(0, sorted.length - 1 - window), sorted.length - 1);
  if (baseline.length < 20) return null;
  const vals = baseline.map((p) => p.v);
  const m = mean(vals);
  const sd = stdev(vals);
  if (!sd || Number.isNaN(sd)) return null;
  return (current.v - m) / sd;
}

/** percentile rank (0-100) of the latest value within its trailing window. */
export function percentileRank(points: Point[], window = 252): number | null {
  if (points.length < 20) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const current = sorted[sorted.length - 1];
  const baseline = sorted.slice(Math.max(0, sorted.length - 1 - window), sorted.length - 1);
  if (baseline.length < 20) return null;
  const below = baseline.filter((p) => p.v <= current.v).length;
  return Math.round((below / baseline.length) * 100);
}

export function changeOverDays(points: Point[], days: number): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const current = sorted[sorted.length - 1];
  const cutoff = new Date(current.t);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const past = sorted.filter((p) => new Date(p.t) <= cutoff).pop();
  if (!past) return null;
  return current.v - past.v;
}

export function pctChangeOverDays(points: Point[], days: number): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const current = sorted[sorted.length - 1];
  const cutoff = new Date(current.t);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const past = sorted.filter((p) => new Date(p.t) <= cutoff).pop();
  if (!past || past.v === 0) return null;
  return ((current.v - past.v) / Math.abs(past.v)) * 100;
}

/** Squashes a z-score onto a 0-100 risk scale. Positive zDirection means "higher value = higher risk". */
export function zToRiskScore(z: number | null, zDirection: 1 | -1 = 1): number | null {
  if (z === null || Number.isNaN(z)) return null;
  const signed = z * zDirection;
  const clamped = Math.max(-3, Math.min(3, signed));
  return Math.round(((clamped + 3) / 6) * 100);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Aligns two series by calendar month and returns (a - b) * scale, e.g. for cross-country yield spreads. */
export function diffSeriesByMonth(a: Point[], b: Point[], scale = 100): Point[] {
  const bMap = new Map(b.map((p) => [p.t.slice(0, 7), p.v]));
  return a
    .map((p) => {
      const bv = bMap.get(p.t.slice(0, 7));
      return bv === undefined ? null : { t: p.t, v: (p.v - bv) * scale };
    })
    .filter((p): p is Point => p !== null);
}

/** Absolute value of each point — useful for "extremity in either direction" risk framings. */
export function absSeries(points: Point[]): Point[] {
  return points.map((p) => ({ t: p.t, v: Math.abs(p.v) }));
}

/** Aligns two same-frequency series by exact date and returns a/b — e.g. cap-weighted/equal-weighted ratios. */
export function ratioSeriesByDate(a: Point[], b: Point[]): Point[] {
  const bMap = new Map(b.map((p) => [p.t.slice(0, 10), p.v]));
  return a
    .map((p) => {
      const bv = bMap.get(p.t.slice(0, 10));
      return bv === undefined || bv === 0 ? null : { t: p.t, v: p.v / bv };
    })
    .filter((p): p is Point => p !== null);
}

export function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

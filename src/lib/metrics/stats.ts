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

/**
 * z-score of the most recent value against its own trailing window (excludes itself from the
 * baseline). A baseline with zero variance (e.g. a status-event-count indicator that has been
 * flat at 0 for its entire trailing window) makes the standard formula divide by zero — rather
 * than returning null and dropping the indicator entirely, a value matching that constant
 * baseline is "no deviation" (z=0), and any value departing from an otherwise perfectly stable
 * baseline is maximally anomalous relative to its own history (clamped to the same +/-3 bound
 * zToRiskScore already clamps to), not "insufficient data".
 */
export function zScore(points: Point[], window = 252): number | null {
  if (points.length < 20) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const current = sorted[sorted.length - 1];
  const baseline = sorted.slice(Math.max(0, sorted.length - 1 - window), sorted.length - 1);
  if (baseline.length < 20) return null;
  const vals = baseline.map((p) => p.v);
  const m = mean(vals);
  const sd = stdev(vals);
  if (Number.isNaN(sd)) return null;
  if (sd === 0) return current.v === m ? 0 : current.v > m ? 3 : -3;
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

/** Outer-joins two series by exact date and sums them, treating a missing side as 0 (e.g. current + noncurrent debt). */
export function sumSeriesByDate(a: Point[], b: Point[]): Point[] {
  const dates = new Set([...a.map((p) => p.t.slice(0, 10)), ...b.map((p) => p.t.slice(0, 10))]);
  const aMap = new Map(a.map((p) => [p.t.slice(0, 10), p.v]));
  const bMap = new Map(b.map((p) => [p.t.slice(0, 10), p.v]));
  return [...dates]
    .map((d) => ({ t: d, v: (aMap.get(d) ?? 0) + (bMap.get(d) ?? 0) }))
    .sort((x, y) => (x.t < y.t ? -1 : 1));
}

/** Subtracts two series aligned by exact date (a - b), requiring both sides present — e.g. FCF = OCF - capex. */
export function subtractSeriesByDate(a: Point[], b: Point[]): Point[] {
  const bMap = new Map(b.map((p) => [p.t.slice(0, 10), p.v]));
  return a
    .map((p) => {
      const bv = bMap.get(p.t.slice(0, 10));
      return bv === undefined ? null : { t: p.t, v: p.v - bv };
    })
    .filter((p): p is Point => p !== null);
}

/**
 * As-of join: for each point in `dense` (e.g. daily prices), finds the latest
 * `sparse` point (e.g. quarterly TTM EPS) dated on or before it and divides
 * dense/sparse — the standard way to combine a daily series with a
 * quarterly-updated fundamental (this is how trailing P/E is computed in
 * practice: today's price over the most recently reported TTM EPS).
 */
export function divideByLastKnown(dense: Point[], sparse: Point[]): Point[] {
  const sortedSparse = [...sparse].sort((a, b) => (a.t < b.t ? -1 : 1));
  const sortedDense = [...dense].sort((a, b) => (a.t < b.t ? -1 : 1));
  const out: Point[] = [];
  let i = 0;
  let lastVal: number | null = null;
  for (const d of sortedDense) {
    while (i < sortedSparse.length && sortedSparse[i].t <= d.t) {
      lastVal = sortedSparse[i].v;
      i++;
    }
    if (lastVal !== null && lastVal !== 0) out.push({ t: d.t, v: d.v / lastVal });
  }
  return out;
}

/**
 * As-of spread: for each point in `index` (the series whose own dates should
 * drive the output cadence — normally the more frequently-updated or more
 * decision-relevant side), finds the latest `lookup` point dated on or
 * before it and returns (index - lookup) * scale. Same as-of join as
 * divideByLastKnown, but subtracting instead of dividing — for yield-curve
 * spreads built from tenors that publish on genuinely different, irregular
 * cadences (e.g. a weekly T-Bill auction vs a monthly OECD 10Y benchmark, or
 * an irregular primary-auction cutoff that only prints on weeks that tenor
 * is actually auctioned).
 */
export function spreadByLastKnown(index: Point[], lookup: Point[], scale = 1): Point[] {
  const sortedLookup = [...lookup].sort((a, b) => (a.t < b.t ? -1 : 1));
  const sortedIndex = [...index].sort((a, b) => (a.t < b.t ? -1 : 1));
  const out: Point[] = [];
  let i = 0;
  let lastVal: number | null = null;
  for (const p of sortedIndex) {
    while (i < sortedLookup.length && sortedLookup[i].t <= p.t) {
      lastVal = sortedLookup[i].v;
      i++;
    }
    if (lastVal !== null) out.push({ t: p.t, v: (p.v - lastVal) * scale });
  }
  return out;
}

/** Trailing rolling sum over the last `window` observations (e.g. TTM = rollingSum(quarterlySeries, 4)). */
export function rollingSum(points: Point[], window: number): Point[] {
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const out: Point[] = [];
  for (let i = window - 1; i < sorted.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += sorted[j].v;
    out.push({ t: sorted[i].t, v: sum });
  }
  return out;
}

export function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

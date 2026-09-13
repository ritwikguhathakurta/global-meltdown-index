import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";
import { COMMODITIES } from "../commodities/taxonomy";

/**
 * Price Cycle Engine — Oilseeds engine, spec §100-101, §106. Computed
 * entirely from World Bank Pink Sheet prices already in this app (monthly
 * since 1960 — 60+ years, well beyond the spec's 20-year minimum). No new
 * ingestion. Covers all 8 Oilseeds-category products in the taxonomy.
 *
 * Cycle boundaries use the standard, disclosed -20%/+20% peak/trough
 * convention — a fixed round number, not fitted or tuned to these series.
 * This is a mechanical drawdown/recovery detector, not a fundamentals-
 * based cycle call.
 *
 * Transition probabilities ("how likely is the current phase to end
 * within N months") are a plain empirical/nonparametric estimate, not a
 * fitted survival model: for the currently-active phase (a bull leg or a
 * bear cycle), take every HISTORICALLY COMPLETED phase of the same type
 * that lasted at least as long as the current phase has so far (the "at
 * risk" set), and compute what fraction of those ended within the next N
 * months from that point. A Wilson score interval is reported alongside
 * it as the actual confidence bound on that proportion — not a vague
 * "high/medium/low confidence" label — precisely because the sample sizes
 * here are small (typically single digits per product over 66 years) and
 * a naive percentage would look far more precise than it is. Below a
 * minimum "at risk" sample of 3, no probability is returned at all rather
 * than showing a number from 1-2 data points.
 *
 * Two durations are tracked per product:
 *  - Bear duration = peak date -> the date price recovers to/above the
 *    prior peak OR bounces +20% off the trough (the full bear phase, not
 *    just the peak-to-trough decline leg — durationMonths below is kept
 *    as that decline-only figure for backward compatibility with the
 *    existing "most recent completed bear cycle" UI card).
 *  - Bull-leg duration = the date a bear phase ends -> the date of the
 *    NEXT cycle's peak (the full uptrend before the next -20% trigger).
 *    The very first bull leg in the series (before any bear has been
 *    observed) is deliberately excluded — its true start predates this
 *    app's data window, so its duration is left-censored, not zero.
 * The currently-ongoing phase is right-censored (we don't know when it
 * ends) and is used only as the conditioning age, never added to the
 * historical sample itself.
 */

const DRAWDOWN_THRESHOLD = 0.2; // -20% from peak confirms a bear cycle
const RECOVERY_THRESHOLD = 0.2; // +20% from trough confirms the next bull leg
const MIN_AT_RISK_SAMPLE = 3; // below this, no probability is shown at all
const PROBABILITY_HORIZONS_MONTHS = [6, 12];

export type PriceCycle = {
  peakDate: string;
  peakValue: number;
  troughDate: string;
  troughValue: number;
  drawdownPct: number;
  durationMonths: number; // peak -> trough (decline leg only)
  totalBearDurationMonths: number; // peak -> full recovery/bull-resumption
  recoveredToPriorPeak: boolean;
};

export type TransitionProbability = {
  horizonMonths: number;
  probability: number; // 0-1, empirical fraction of at-risk historical phases that ended within this horizon
  ciLow: number; // Wilson 95% CI lower bound
  ciHigh: number; // Wilson 95% CI upper bound
  sampleSize: number; // historical same-phase-type durations "at risk" (>= current phase age)
};

export type PriceCycleResult = {
  slug: string;
  label: string;
  unit: string;
  asOf: string | null;
  currentValue: number | null;
  currentPhase: "Bull" | "Bear" | null;
  runningPeakValue: number | null;
  runningPeakDate: string | null;
  distanceFromPeakPct: number | null;
  monthsSincePeak: number | null;
  cycles: PriceCycle[]; // most recent first, capped to last 10
  historicalCycleCount: number; // ALL detected bear cycles since 1960, not just the capped list above
  historicalBullLegCount: number; // ALL completed (non-censored) bull legs since 1960
  avgDrawdownPct: number | null;
  avgDurationMonths: number | null;
  currentPhaseAgeMonths: number | null; // months since the CURRENT phase began (null if left-censored — still in the first, pre-data bull leg)
  transitionProbabilities: TransitionProbability[] | null; // null if currentPhaseAgeMonths is null or the at-risk sample is below MIN_AT_RISK_SAMPLE
};

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db_ = new Date(b);
  return (db_.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db_.getUTCMonth() - da.getUTCMonth());
}

// Standard Wilson score interval for a binomial proportion — chosen over a
// naive normal-approximation interval because it stays inside [0,1] and
// stays sane at the small sample sizes these cycle counts actually have.
function wilsonInterval(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const center = phat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (center - margin) / denom), high: Math.min(1, (center + margin) / denom) };
}

function computeTransitionProbabilities(historicalDurations: number[], currentAgeMonths: number): TransitionProbability[] | null {
  const atRisk = historicalDurations.filter((d) => d >= currentAgeMonths);
  if (atRisk.length < MIN_AT_RISK_SAMPLE) return null;
  return PROBABILITY_HORIZONS_MONTHS.map((h) => {
    const n = atRisk.length;
    const ended = atRisk.filter((d) => d <= currentAgeMonths + h).length;
    const { low, high } = wilsonInterval(ended, n);
    return { horizonMonths: h, probability: ended / n, ciLow: low, ciHigh: high, sampleSize: n };
  });
}

function detectCycles(sorted: Point[]): {
  cycles: PriceCycle[];
  bullLegDurations: number[];
  state: "bull" | "bear";
  peakVal: number;
  peakDate: string;
  troughVal: number;
  troughDate: string;
  currentPhaseStartDate: string | null; // null only while still in the left-censored first bull leg
} {
  const cycles: PriceCycle[] = [];
  const bullLegDurations: number[] = [];
  let state: "bull" | "bear" = "bull";
  let peakVal = sorted[0].v;
  let peakDate = sorted[0].t;
  let troughVal = sorted[0].v;
  let troughDate = sorted[0].t;
  let bullStartDate: string | null = null; // null = left-censored first leg, true start unknown
  let currentPhaseStartDate: string | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const { t, v } = sorted[i];
    if (state === "bull") {
      if (v > peakVal) {
        peakVal = v;
        peakDate = t;
      } else if (v <= peakVal * (1 - DRAWDOWN_THRESHOLD)) {
        if (bullStartDate !== null) bullLegDurations.push(monthsBetween(bullStartDate, peakDate));
        state = "bear";
        troughVal = v;
        troughDate = t;
        currentPhaseStartDate = peakDate;
      }
    } else {
      if (v < troughVal) {
        troughVal = v;
        troughDate = t;
      }
      const recoveredToPriorPeak = v >= peakVal;
      const boundedFromTrough = v >= troughVal * (1 + RECOVERY_THRESHOLD);
      if (recoveredToPriorPeak || boundedFromTrough) {
        cycles.push({
          peakDate,
          peakValue: peakVal,
          troughDate,
          troughValue: troughVal,
          drawdownPct: (troughVal / peakVal - 1) * 100,
          durationMonths: monthsBetween(peakDate, troughDate),
          totalBearDurationMonths: monthsBetween(peakDate, t),
          recoveredToPriorPeak,
        });
        state = "bull";
        bullStartDate = t;
        currentPhaseStartDate = t;
        peakVal = v;
        peakDate = t;
      }
    }
  }

  return { cycles, bullLegDurations, state, peakVal, peakDate, troughVal, troughDate, currentPhaseStartDate };
}

async function buildCycleResult(db: SupabaseClient, slug: string, label: string, unit: string): Promise<PriceCycleResult> {
  const series = await fetchSeries(db, `commodity.${slug}.price`, "1960-01-01");
  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  if (sorted.length < 24) {
    return {
      slug,
      label,
      unit,
      asOf: null,
      currentValue: null,
      currentPhase: null,
      runningPeakValue: null,
      runningPeakDate: null,
      distanceFromPeakPct: null,
      monthsSincePeak: null,
      cycles: [],
      historicalCycleCount: 0,
      historicalBullLegCount: 0,
      avgDrawdownPct: null,
      avgDurationMonths: null,
      currentPhaseAgeMonths: null,
      transitionProbabilities: null,
    };
  }

  const { cycles, bullLegDurations, state, peakVal, peakDate, currentPhaseStartDate } = detectCycles(sorted);
  const last = sorted[sorted.length - 1];
  const avgDrawdownPct = cycles.length > 0 ? cycles.reduce((a, c) => a + c.drawdownPct, 0) / cycles.length : null;
  const avgDurationMonths = cycles.length > 0 ? cycles.reduce((a, c) => a + c.durationMonths, 0) / cycles.length : null;

  const currentPhaseAgeMonths = currentPhaseStartDate ? monthsBetween(currentPhaseStartDate, last.t) : null;
  const transitionProbabilities =
    currentPhaseAgeMonths !== null
      ? computeTransitionProbabilities(state === "bear" ? cycles.map((c) => c.totalBearDurationMonths) : bullLegDurations, currentPhaseAgeMonths)
      : null;

  return {
    slug,
    label,
    unit,
    asOf: last.t,
    currentValue: last.v,
    currentPhase: state === "bull" ? "Bull" : "Bear",
    runningPeakValue: peakVal,
    runningPeakDate: peakDate,
    distanceFromPeakPct: (last.v / peakVal - 1) * 100,
    monthsSincePeak: monthsBetween(peakDate, last.t),
    cycles: cycles.slice(-10).reverse(),
    historicalCycleCount: cycles.length,
    historicalBullLegCount: bullLegDurations.length,
    avgDrawdownPct,
    avgDurationMonths,
    currentPhaseAgeMonths,
    transitionProbabilities,
  };
}

const CYCLE_COMMODITIES: { slug: string; label: string; unit: string }[] = COMMODITIES.filter((c) => c.category === "Oilseeds").map((c) => ({
  slug: c.slug,
  label: c.label,
  unit: c.unit,
}));

export async function getOilseedsPriceCycles(db: SupabaseClient): Promise<PriceCycleResult[]> {
  return Promise.all(CYCLE_COMMODITIES.map((c) => buildCycleResult(db, c.slug, c.label, c.unit)));
}

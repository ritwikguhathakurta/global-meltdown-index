import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";
import { COMMODITIES, type CommodityCategory } from "../commodities/taxonomy";

/**
 * Price Cycle Engine, generalized across every commodity category — see
 * oilseedsPriceCycles.ts (the original, Oilseeds-only version this factors
 * out of; that file now thin-wraps this one). Computed entirely from
 * already-ingested price history (World Bank Pink Sheet since 1960, or IMF
 * PCPS via DBnomics for Critical Minerals — whatever history genuinely
 * exists per product; products below the 24-observation floor return a
 * null-current-phase result rather than a spurious read on a short series).
 *
 * See oilseedsPriceCycles.ts's own doc comment for the full -20%/+20%
 * drawdown/recovery methodology and the Wilson-CI transition-probability
 * methodology, reused verbatim here.
 */

const DRAWDOWN_THRESHOLD = 0.2;
const RECOVERY_THRESHOLD = 0.2;
const MIN_AT_RISK_SAMPLE = 3;
const PROBABILITY_HORIZONS_MONTHS = [6, 12];

export type PriceCycle = {
  peakDate: string;
  peakValue: number;
  troughDate: string;
  troughValue: number;
  drawdownPct: number;
  durationMonths: number;
  totalBearDurationMonths: number;
  recoveredToPriorPeak: boolean;
};

export type TransitionProbability = {
  horizonMonths: number;
  probability: number;
  ciLow: number;
  ciHigh: number;
  sampleSize: number;
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
  cycles: PriceCycle[];
  historicalCycleCount: number;
  historicalBullLegCount: number;
  avgDrawdownPct: number | null;
  avgDurationMonths: number | null;
  currentPhaseAgeMonths: number | null;
  transitionProbabilities: TransitionProbability[] | null;
};

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db_ = new Date(b);
  return (db_.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db_.getUTCMonth() - da.getUTCMonth());
}

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
  currentPhaseStartDate: string | null;
} {
  const cycles: PriceCycle[] = [];
  const bullLegDurations: number[] = [];
  let state: "bull" | "bear" = "bull";
  let peakVal = sorted[0].v;
  let peakDate = sorted[0].t;
  let troughVal = sorted[0].v;
  let troughDate = sorted[0].t;
  let bullStartDate: string | null = null;
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

export async function getCommodityPriceCyclesForCategory(db: SupabaseClient, category: CommodityCategory): Promise<PriceCycleResult[]> {
  const commodities = COMMODITIES.filter((c) => c.category === category);
  return Promise.all(commodities.map((c) => buildCycleResult(db, c.slug, c.label, c.unit)));
}

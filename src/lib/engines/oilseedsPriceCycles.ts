import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";
import { COMMODITIES } from "../commodities/taxonomy";

/**
 * Price Cycle Engine — Oilseeds engine, spec §100-101, §106. Computed
 * entirely from World Bank Pink Sheet prices already in this app (monthly
 * since 1960 — 60+ years, well beyond the spec's 20-year minimum). No new
 * ingestion. Covers all 8 Oilseeds-category products in the taxonomy
 * (Palm Oil, Soybean Oil, Soybeans, Soybean Meal, Rapeseed Oil, Sunflower
 * Oil, Palm Kernel Oil, Coconut Oil), not just the original two — every one
 * of them has the same 1960-present Pink Sheet history, so there's no
 * reason to leave six of them out.
 *
 * Cycle boundaries use the standard, disclosed -20%/+20% peak/trough
 * convention (the same threshold widely used to call bear/bull markets) —
 * a fixed round number, not fitted or tuned to these series. This is a
 * mechanical drawdown/recovery detector, not the spec's fuller cycle
 * classification (no "catalyst" tagging, no distribution/accumulation
 * sub-phases, no regime labels) — those require subjective judgment this
 * app does not fabricate.
 */

const DRAWDOWN_THRESHOLD = 0.2; // -20% from peak confirms a bear cycle
const RECOVERY_THRESHOLD = 0.2; // +20% from trough confirms the next bull leg

export type PriceCycle = {
  peakDate: string;
  peakValue: number;
  troughDate: string;
  troughValue: number;
  drawdownPct: number;
  durationMonths: number;
  recoveredToPriorPeak: boolean;
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
  historicalCycleCount: number; // ALL detected cycles since 1960, not just the capped list above
  avgDrawdownPct: number | null;
  avgDurationMonths: number | null;
};

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db_ = new Date(b);
  return (db_.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db_.getUTCMonth() - da.getUTCMonth());
}

function detectCycles(sorted: Point[]): { cycles: PriceCycle[]; state: "bull" | "bear"; peakVal: number; peakDate: string; troughVal: number; troughDate: string } {
  const cycles: PriceCycle[] = [];
  let state: "bull" | "bear" = "bull";
  let peakVal = sorted[0].v;
  let peakDate = sorted[0].t;
  let troughVal = sorted[0].v;
  let troughDate = sorted[0].t;

  for (let i = 1; i < sorted.length; i++) {
    const { t, v } = sorted[i];
    if (state === "bull") {
      if (v > peakVal) {
        peakVal = v;
        peakDate = t;
      } else if (v <= peakVal * (1 - DRAWDOWN_THRESHOLD)) {
        state = "bear";
        troughVal = v;
        troughDate = t;
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
          recoveredToPriorPeak,
        });
        state = "bull";
        peakVal = v;
        peakDate = t;
      }
    }
  }

  return { cycles, state, peakVal, peakDate, troughVal, troughDate };
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
      avgDrawdownPct: null,
      avgDurationMonths: null,
    };
  }

  const { cycles, state, peakVal, peakDate } = detectCycles(sorted);
  const last = sorted[sorted.length - 1];
  const avgDrawdownPct = cycles.length > 0 ? cycles.reduce((a, c) => a + c.drawdownPct, 0) / cycles.length : null;
  const avgDurationMonths = cycles.length > 0 ? cycles.reduce((a, c) => a + c.durationMonths, 0) / cycles.length : null;

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
    avgDrawdownPct,
    avgDurationMonths,
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

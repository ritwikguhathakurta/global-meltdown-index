import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, type Point } from "../metrics/stats";
import { NASA_POWER_REGIONS } from "../sources/nasaPowerRainfall";

/**
 * Regional Rainfall Anomaly — Oilseeds engine, spec §29-30. Computed
 * entirely from NASA POWER precipitation already ingested (no new source
 * call here). Anomaly = latest month's value vs. that same calendar
 * month's own historical average across all prior years — a plain,
 * disclosed baseline comparison, not a fitted yield-impact estimate (see
 * nasaPowerRainfall.ts for why a lag model isn't built).
 */

export type RainfallRegionResult = {
  slug: string;
  label: string;
  country: "Malaysia" | "Indonesia";
  latestValue: number | null; // mm/day, monthly mean
  asOf: string | null;
  historicalAvgForMonth: number | null;
  anomalyPct: number | null;
  yearsOfHistory: number;
};

async function buildRegion(db: SupabaseClient, region: (typeof NASA_POWER_REGIONS)[number]): Promise<RainfallRegionResult> {
  const series: Point[] = await fetchSeries(db, `climate.rainfall.${region.slug}`, "2000-01-01");
  const last = latest(series);
  if (!last) {
    return { slug: region.slug, label: region.label, country: region.country, latestValue: null, asOf: null, historicalAvgForMonth: null, anomalyPct: null, yearsOfHistory: 0 };
  }

  const currentMonth = new Date(last.t).getUTCMonth();
  const sameMonthPriorYears = series.filter((p) => new Date(p.t).getUTCMonth() === currentMonth && p.t !== last.t);

  const historicalAvgForMonth = sameMonthPriorYears.length > 0 ? sameMonthPriorYears.reduce((a, p) => a + p.v, 0) / sameMonthPriorYears.length : null;
  const anomalyPct = historicalAvgForMonth && historicalAvgForMonth !== 0 ? ((last.v - historicalAvgForMonth) / historicalAvgForMonth) * 100 : null;

  return {
    slug: region.slug,
    label: region.label,
    country: region.country,
    latestValue: last.v,
    asOf: last.t,
    historicalAvgForMonth,
    anomalyPct,
    yearsOfHistory: sameMonthPriorYears.length,
  };
}

export async function getOilseedsRainfall(db: SupabaseClient): Promise<RainfallRegionResult[]> {
  return Promise.all(NASA_POWER_REGIONS.map((r) => buildRegion(db, r)));
}

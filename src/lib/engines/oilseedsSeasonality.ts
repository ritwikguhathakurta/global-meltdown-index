import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";

/**
 * Production/Export Seasonality Engine — Oilseeds engine, spec §18-20.
 * Computed entirely from monthly series already ingested (MPOB mirror
 * exports for Malaysia, BPS large-estate production for Indonesia) — no
 * new source calls.
 *
 * Monthly Index = that month's value / that calendar year's own average
 * monthly value (spec §18's own formula, applied literally), then averaged
 * across all available years per calendar month. Malaysia uses the
 * palmoileconomics.com MPOB mirror's po_export field rather than MPOB's own
 * site (which only goes back to 2024) specifically because that mirror,
 * despite having real gaps in other years, has 6 fully complete calendar
 * years (2013/2014/2017/2021/2024/2025) — the buildSeasonality loop below
 * already discards any year missing even one month, so the gaps simply
 * mean fewer contributing years, not corrupted ones. Indonesia's BPS
 * monthly large-estate series runs 2009-present (~18 years). Neither is
 * close to the spec's 20-year ask, so this is explicitly labeled with how
 * many calendar years actually back each seasonal reading rather than
 * presented as a mature curve.
 *
 * Phase classification (spec §20) ranks the 12 monthly index values for the
 * current month: highest -> Peak Crop, lowest -> Seasonal Bottom, bottom
 * third (excluding the lowest) -> Low Crop, else Rising Crop if this
 * month's index exceeds the prior calendar month's, else Declining Crop.
 * This is a disclosed labeling rule on real seasonal numbers, not a fitted
 * or judgment-based call.
 */

export type ProductionCyclePhase = "Peak Crop" | "Rising Crop" | "Low Crop" | "Declining Crop" | "Seasonal Bottom";

export type SeasonalityResult = {
  slug: string;
  label: string;
  yearsOfHistory: number;
  monthlyIndex: { month: number; index: number; observations: number }[]; // month 1-12
  currentMonth: number | null;
  currentMonthIndex: number | null;
  phase: ProductionCyclePhase | null;
  asOf: string | null;
};

const MIN_YEARS = 2;

function classifyPhase(monthlyIndex: { month: number; index: number }[], currentMonth: number): ProductionCyclePhase {
  const ranked = [...monthlyIndex].sort((a, b) => b.index - a.index);
  const rank = ranked.findIndex((m) => m.month === currentMonth) + 1; // 1 = highest
  const n = monthlyIndex.length;
  if (rank === 1) return "Peak Crop";
  if (rank === n) return "Seasonal Bottom";
  if (rank > n - 3) return "Low Crop";

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const current = monthlyIndex.find((m) => m.month === currentMonth)!.index;
  const prior = monthlyIndex.find((m) => m.month === prevMonth)?.index ?? current;
  return current >= prior ? "Rising Crop" : "Declining Crop";
}

async function buildSeasonality(db: SupabaseClient, metricKey: string, slug: string, label: string): Promise<SeasonalityResult> {
  const series = await fetchSeries(db, metricKey, "2000-01-01");
  const sorted: Point[] = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));

  const byYear = new Map<number, { month: number; value: number }[]>();
  for (const p of sorted) {
    const d = new Date(p.t);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ month, value: p.v });
  }

  // Only years with all 12 months observed contribute a clean within-year average.
  const fullYears = [...byYear.entries()].filter(([, months]) => months.length === 12);

  if (fullYears.length < MIN_YEARS) {
    return {
      slug,
      label,
      yearsOfHistory: fullYears.length,
      monthlyIndex: [],
      currentMonth: null,
      currentMonthIndex: null,
      phase: null,
      asOf: sorted.length > 0 ? sorted[sorted.length - 1].t : null,
    };
  }

  const indexByMonth = new Map<number, number[]>();
  for (const [, months] of fullYears) {
    const yearAvg = months.reduce((a, m) => a + m.value, 0) / 12;
    if (yearAvg === 0) continue;
    for (const m of months) {
      if (!indexByMonth.has(m.month)) indexByMonth.set(m.month, []);
      indexByMonth.get(m.month)!.push(m.value / yearAvg);
    }
  }

  const monthlyIndex = [...indexByMonth.entries()]
    .map(([month, vals]) => ({ month, index: vals.reduce((a, b) => a + b, 0) / vals.length, observations: vals.length }))
    .sort((a, b) => a.month - b.month);

  const last = sorted[sorted.length - 1];
  const currentMonth = last ? new Date(last.t).getUTCMonth() + 1 : null;
  const currentEntry = currentMonth ? monthlyIndex.find((m) => m.month === currentMonth) ?? null : null;
  const phase = currentMonth && monthlyIndex.length === 12 ? classifyPhase(monthlyIndex, currentMonth) : null;

  return {
    slug,
    label,
    yearsOfHistory: fullYears.length,
    monthlyIndex,
    currentMonth,
    currentMonthIndex: currentEntry?.index ?? null,
    phase,
    asOf: last?.t ?? null,
  };
}

export async function getOilseedsSeasonality(db: SupabaseClient): Promise<SeasonalityResult[]> {
  return Promise.all([
    buildSeasonality(db, "commodity.palm_oil.malaysia.mpob_mirror.po_export", "malaysia_exports", "Malaysia Palm Oil Exports (MPOB)"),
    buildSeasonality(db, "commodity.palm_oil.indonesia.production_monthly_large_estate", "indonesia_production", "Indonesia Oil Palm Production, Large Estates (BPS)"),
  ]);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, zScore, pctChangeOverDays, type Point } from "../metrics/stats";

/**
 * Soybean crush margin ("board crush") — Oilseeds engine, spec §22-24, §61.
 * Computed entirely from World Bank Pink Sheet prices already in this app
 * (commodity.soybeans.price, commodity.soybean_oil.price,
 * commodity.soybean_meal.price — all $/mt, monthly since 1960).
 *
 * Margin = (oil_yield * oil_price) + (meal_yield * meal_price) - seed_price,
 * per metric ton of soybeans crushed. Oil/meal yields (18.5% / 79.0% by
 * weight, ~2.5% processing loss) are published industry-average extraction
 * ratios (typical for a modern soybean crush plant), NOT country- or
 * plant-specific — the spec (§21) explicitly warns against a single
 * universal ratio, and country-specific ratios aren't available from any
 * free source checked. This is disclosed as a genuine simplification, not
 * hidden behind a precise-looking number.
 *
 * Only Soybean has all three legs priced in this app's free sources —
 * Rapeseed/Canola and Sunflower crush margins would need a raw-seed price
 * series neither the Pink Sheet nor IMF PCPS carries (only their oils are
 * priced), so those are not computed here rather than approximated.
 */

const OIL_YIELD = 0.185;
const MEAL_YIELD = 0.79;

export type CrushMarginResult = {
  latestValue: number | null;
  latestDate: string | null;
  change12m: number | null;
  zScore5y: number | null;
  seedPrice: number | null;
  oilPrice: number | null;
  mealPrice: number | null;
  oilYield: number;
  mealYield: number;
};

export async function getSoybeanCrushMargin(db: SupabaseClient): Promise<CrushMarginResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 10);
  const sinceIso = since.toISOString();

  const [seed, oil, meal] = await Promise.all([
    fetchSeries(db, "commodity.soybeans.price", sinceIso),
    fetchSeries(db, "commodity.soybean_oil.price", sinceIso),
    fetchSeries(db, "commodity.soybean_meal.price", sinceIso),
  ]);

  const oilByDate = new Map(oil.map((p) => [p.t, p.v]));
  const mealByDate = new Map(meal.map((p) => [p.t, p.v]));

  const marginSeries: Point[] = [];
  for (const s of seed) {
    const o = oilByDate.get(s.t);
    const m = mealByDate.get(s.t);
    if (o === undefined || m === undefined) continue;
    marginSeries.push({ t: s.t, v: OIL_YIELD * o + MEAL_YIELD * m - s.v });
  }
  marginSeries.sort((a, b) => (a.t < b.t ? -1 : 1));

  const lastMargin = latest(marginSeries);
  const lastSeed = latest(seed);
  const lastOil = latest(oil);
  const lastMeal = latest(meal);

  return {
    latestValue: lastMargin?.v ?? null,
    latestDate: lastMargin?.t ?? null,
    change12m: pctChangeOverDays(marginSeries, 365),
    zScore5y: zScore(marginSeries, 60),
    seedPrice: lastSeed?.v ?? null,
    oilPrice: lastOil?.v ?? null,
    mealPrice: lastMeal?.v ?? null,
    oilYield: OIL_YIELD,
    mealYield: MEAL_YIELD,
  };
}

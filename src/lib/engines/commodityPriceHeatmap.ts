import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays, type Point } from "../metrics/stats";
import { COMMODITIES, type CommodityCategory } from "../commodities/taxonomy";
import { classifyDirection, momentumScoreForHorizons, type CommodityDirectionLabel } from "./commodities";

/**
 * Multi-Timeframe Price Heatmap, generalized across every commodity
 * category — see oilseedsPriceHeatmap.ts (the original, Oilseeds-only
 * version this factors out of; that file now thin-wraps this one so its
 * existing callers/behavior are unchanged).
 *
 * Short-term (0-30D) is only ever computed from a genuine DAILY price
 * series, passed in per-slug via `dailySeriesMetricKeyBySlug` — every
 * commodity here otherwise only has monthly World Bank Pink Sheet / IMF
 * PCPS data (verified in worldBankCommodities.ts/dbnomicsCriticalMinerals.ts),
 * where a 0-30 day window can't reflect a genuine sample. Products with no
 * entry in that map read N/A there rather than approximating from a single
 * monthly print. Medium (30-90D) and Long (>90D) use the monthly series for
 * every product, since 90+ days comfortably spans multiple real monthly
 * observations.
 */

export type HeatmapCell = {
  changePct: number | null;
  momentumScore: number | null;
  direction: CommodityDirectionLabel;
  available: boolean;
  unavailableReason?: string;
};

export type CommodityHeatmapRow = {
  slug: string;
  label: string;
  unit: string;
  price: number | null;
  asOf: string | null;
  short: HeatmapCell;
  medium: HeatmapCell;
  long: HeatmapCell;
};

export type CommodityPriceHeatmapResult = {
  rows: CommodityHeatmapRow[];
  asOf: string | null;
};

const SHORT_HORIZONS = [
  { days: 7, weight: 0.3 },
  { days: 14, weight: 0.3 },
  { days: 30, weight: 0.4 },
];
const MEDIUM_HORIZONS = [
  { days: 30, weight: 0.4 },
  { days: 90, weight: 0.6 },
];
const LONG_HORIZONS = [
  { days: 182, weight: 0.25 },
  { days: 365, weight: 0.45 },
  { days: 1095, weight: 0.3 },
];

const UNAVAILABLE_SHORT_CELL: HeatmapCell = {
  changePct: null,
  momentumScore: null,
  direction: "INSUFFICIENT_DATA",
  available: false,
  unavailableReason: "Only monthly price data exists for this product — no genuine 0-30 day sample to measure.",
};

function buildCell(series: Point[], horizons: { days: number; weight: number }[], changeDays: number): HeatmapCell {
  const momentumScore = momentumScoreForHorizons(series, horizons);
  return {
    changePct: pctChangeOverDays(series, changeDays),
    momentumScore,
    direction: classifyDirection(momentumScore),
    available: true,
  };
}

export async function getCommodityPriceHeatmapForCategory(
  db: SupabaseClient,
  category: CommodityCategory,
  dailySeriesMetricKeyBySlug: Record<string, string> = {}
): Promise<CommodityPriceHeatmapResult> {
  const commodities = COMMODITIES.filter((c) => c.category === category);
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const dailyKeys = [...new Set(Object.values(dailySeriesMetricKeyBySlug))];
  const [seriesList, dailySeriesList] = await Promise.all([
    Promise.all(commodities.map((c) => fetchSeries(db, `commodity.${c.slug}.price`, sinceIso))),
    Promise.all(dailyKeys.map((k) => fetchSeries(db, k, sinceIso))),
  ]);
  const dailyByKey = new Map(dailyKeys.map((k, i) => [k, dailySeriesList[i]]));

  let asOf: string | null = null;
  const rows: CommodityHeatmapRow[] = commodities.map((c, i) => {
    const series = seriesList[i];
    const last = latest(series);
    if (last && (!asOf || last.t > asOf)) asOf = last.t;

    const dailyKey = dailySeriesMetricKeyBySlug[c.slug];
    const dailySeries = dailyKey ? dailyByKey.get(dailyKey) ?? [] : [];
    const short = dailySeries.length > 0 ? buildCell(dailySeries, SHORT_HORIZONS, 30) : UNAVAILABLE_SHORT_CELL;

    return {
      slug: c.slug,
      label: c.label,
      unit: c.unit,
      price: last?.v ?? null,
      asOf: last?.t ?? null,
      short,
      medium: buildCell(series, MEDIUM_HORIZONS, 90),
      long: buildCell(series, LONG_HORIZONS, 365),
    };
  });

  return { rows, asOf };
}

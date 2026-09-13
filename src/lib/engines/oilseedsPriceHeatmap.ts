import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays, type Point } from "../metrics/stats";
import { COMMODITIES } from "../commodities/taxonomy";
import { classifyDirection, momentumScoreForHorizons, type CommodityDirectionLabel } from "./commodities";

/**
 * Multi-Timeframe Price Heatmap — Oilseeds engine. Reuses the exact
 * z-scored-return methodology from the main Commodities heatmap
 * (commodities.ts's rollingReturnZScore/momentumScoreForHorizons), but
 * split into three timeframe buckets (Short 0-30D / Medium 30-90D / Long
 * >90D) instead of one blended score, so each column genuinely reflects
 * only that horizon's own returns.
 *
 * Short-term (0-30D) is only computed for Palm Oil, from CME's daily
 * CPO=F futures (commodity.palm_oil.cme_futures_price, tier 3, verified
 * daily elsewhere in this app). Every other Oilseeds product only has
 * monthly World Bank Pink Sheet data (verified in worldBankCommodities.ts
 * — frequency is hardcoded "monthly" there because that's genuinely all
 * the source publishes). A "0-30 day" window on a monthly series resolves
 * to at most one single print with no real intra-window sampling, so
 * showing a number there would misrepresent monthly data as a short-term
 * read — those rows are marked unavailable instead of approximated.
 *
 * Medium (30-90D) and Long (>90D) use the monthly Pink Sheet series for
 * all 8 products: 90 days is roughly 3 monthly prints and >90 days spans
 * several more, so both buckets reflect genuinely sampled observations.
 */

export type HeatmapCell = {
  changePct: number | null;
  momentumScore: number | null;
  direction: CommodityDirectionLabel;
  available: boolean;
  unavailableReason?: string;
};

export type OilseedsHeatmapRow = {
  slug: string;
  label: string;
  unit: string;
  price: number | null;
  asOf: string | null;
  short: HeatmapCell;
  medium: HeatmapCell;
  long: HeatmapCell;
};

export type OilseedsHeatmapResult = {
  rows: OilseedsHeatmapRow[];
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

export async function getOilseedsPriceHeatmap(db: SupabaseClient): Promise<OilseedsHeatmapResult> {
  const oilseeds = COMMODITIES.filter((c) => c.category === "Oilseeds");
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const [seriesList, cmeSeries] = await Promise.all([
    Promise.all(oilseeds.map((c) => fetchSeries(db, `commodity.${c.slug}.price`, sinceIso))),
    fetchSeries(db, "commodity.palm_oil.cme_futures_price", sinceIso),
  ]);

  let asOf: string | null = null;
  const rows: OilseedsHeatmapRow[] = oilseeds.map((c, i) => {
    const series = seriesList[i];
    const last = latest(series);
    if (last && (!asOf || last.t > asOf)) asOf = last.t;

    const short = c.slug === "palm_oil" && cmeSeries.length > 0 ? buildCell(cmeSeries, SHORT_HORIZONS, 30) : UNAVAILABLE_SHORT_CELL;

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

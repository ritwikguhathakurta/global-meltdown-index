import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays, percentileRank } from "../metrics/stats";
import { CHEMICALS, type ChemicalCategory } from "../commodities/chemicalsTaxonomy";
import { classifyDirection, momentumScoreForHorizons, type CommodityDirectionLabel } from "./commodities";

/**
 * Chemicals Overview — Phase 1 of the Chemicals engine. See
 * chemicalsTaxonomy.ts's own doc comment: every value here is a US
 * Producer Price Index (1982=100), not a global spot price, since no free
 * global chemical spot-price source exists. Momentum methodology is the
 * exact same horizon-weighted z-scored-return blend as the main Commodities
 * engine (commodities.ts), applied to these index series instead of Pink
 * Sheet prices.
 */

const MOMENTUM_HORIZONS = [
  { days: 30, weight: 0.1 },
  { days: 90, weight: 0.2 },
  { days: 182, weight: 0.25 },
  { days: 365, weight: 0.3 },
  { days: 1095, weight: 0.15 },
];

export type ChemicalRow = {
  slug: string;
  label: string;
  category: ChemicalCategory;
  indexValue: number | null;
  asOf: string | null;
  change1m: number | null;
  change3m: number | null;
  change12m: number | null;
  momentumScore: number | null;
  direction: CommodityDirectionLabel;
  indexPercentile5y: number | null;
};

export type ChemicalsOverviewResult = {
  rows: ChemicalRow[];
  asOf: string | null;
};

export async function getChemicalsOverview(db: SupabaseClient): Promise<ChemicalsOverviewResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const seriesList = await Promise.all(CHEMICALS.map((c) => fetchSeries(db, c.metricKey, sinceIso)));

  let asOf: string | null = null;
  const rows: ChemicalRow[] = CHEMICALS.map((c, i) => {
    const series = seriesList[i];
    const last = latest(series);
    if (last && (!asOf || last.t > asOf)) asOf = last.t;
    const momentumScore = momentumScoreForHorizons(series, MOMENTUM_HORIZONS);
    return {
      slug: c.slug,
      label: c.label,
      category: c.category,
      indexValue: last?.v ?? null,
      asOf: last?.t ?? null,
      change1m: pctChangeOverDays(series, 30),
      change3m: pctChangeOverDays(series, 90),
      change12m: pctChangeOverDays(series, 365),
      momentumScore,
      direction: classifyDirection(momentumScore),
      indexPercentile5y: percentileRank(series, 60),
    };
  });

  return { rows, asOf };
}

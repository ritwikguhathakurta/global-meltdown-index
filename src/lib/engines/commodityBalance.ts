import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays, percentileRank } from "../metrics/stats";
import { BALANCE_COMMODITIES, type BalanceCategory } from "../commodities/balanceTaxonomy";

/**
 * Global supply-demand balance table — Commodities engine, Phase 2. Real
 * USDA PSD production/consumption/ending-stocks data (usdaPsd.ts), annual,
 * for 20 commodities across Grains/Oilseeds/Soft Commodities/Livestock.
 *
 * This is intentionally separate from the price-momentum engine
 * (engines/commodities.ts) — it answers "is the physical market tightening
 * or loosening," not "is the price trending." Stocks-to-use ratio (ending
 * stocks / consumption) is the standard USDA tightness metric: a falling
 * ratio means the world is drawing down inventory faster than it's
 * replacing it.
 */

export type BalanceRow = {
  slug: string;
  label: string;
  category: BalanceCategory;
  unit: string;
  marketYear: number | null;
  production: number | null;
  consumption: number | null;
  endingStocks: number | null;
  productionYoy: number | null;
  stocksToUsePct: number | null;
  stocksToUseYoy: number | null;
  /** where the latest stocks-to-use ratio sits vs. its own full history, 0 (tightest ever) to 100 (loosest ever) */
  stocksToUsePercentile: number | null;
};

export type CommodityBalanceResult = {
  rows: BalanceRow[];
};

export async function getCommodityBalances(db: SupabaseClient): Promise<CommodityBalanceResult> {
  const since = new Date();
  // 45 years gives most commodities close to their full available PSD/FAOSTAT
  // history for the stocks-to-use percentile below, rather than an arbitrary
  // recent window that would understate a multi-decade tightness cycle.
  since.setUTCFullYear(since.getUTCFullYear() - 45);
  const sinceIso = since.toISOString();

  const rows: BalanceRow[] = [];
  for (const commodity of BALANCE_COMMODITIES) {
    const [production, consumption, endingStocks] = await Promise.all([
      fetchSeries(db, `commodity.${commodity.slug}.production`, sinceIso),
      fetchSeries(db, `commodity.${commodity.slug}.consumption`, sinceIso),
      fetchSeries(db, `commodity.${commodity.slug}.ending_stocks`, sinceIso),
    ]);

    const lastProduction = latest(production);
    const lastConsumption = latest(consumption);
    const lastStocks = latest(endingStocks);
    if (!lastProduction && !lastConsumption && !lastStocks) continue;

    const marketYear = lastProduction?.t ?? lastConsumption?.t ?? lastStocks?.t ?? null;

    const stocksToUseSeries = endingStocks
      .map((s) => {
        const c = consumption.find((x) => x.t === s.t);
        return c && c.v !== 0 ? { t: s.t, v: (s.v / c.v) * 100 } : null;
      })
      .filter((p): p is { t: string; v: number } => p !== null)
      .sort((a, b) => (a.t < b.t ? -1 : 1));

    const lastStocksToUse = latest(stocksToUseSeries);

    rows.push({
      slug: commodity.slug,
      label: commodity.label,
      category: commodity.category,
      unit: commodity.unit,
      marketYear: marketYear ? new Date(marketYear).getUTCFullYear() : null,
      production: lastProduction?.v ?? null,
      consumption: lastConsumption?.v ?? null,
      endingStocks: lastStocks?.v ?? null,
      productionYoy: pctChangeOverDays(production, 365),
      stocksToUsePct: lastStocksToUse?.v ?? null,
      stocksToUseYoy: pctChangeOverDays(stocksToUseSeries, 365),
      stocksToUsePercentile: percentileRank(stocksToUseSeries, 60),
    });
  }

  return { rows };
}

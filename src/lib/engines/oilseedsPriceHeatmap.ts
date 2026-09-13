import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommodityPriceHeatmapForCategory, type CommodityHeatmapRow, type CommodityPriceHeatmapResult, type HeatmapCell } from "./commodityPriceHeatmap";

/**
 * Multi-Timeframe Price Heatmap — Oilseeds engine. Thin wrapper around the
 * generalized commodityPriceHeatmap.ts (which this file's original
 * Oilseeds-only implementation was factored out into, so the same
 * methodology now also powers the other commodity-category pages). See
 * that file's doc comment for the full methodology.
 *
 * Short-term (0-30D) is only computed for Palm Oil, from CME's daily CPO=F
 * futures (commodity.palm_oil.cme_futures_price, tier 3, verified daily
 * elsewhere in this app) — every other Oilseeds product only has monthly
 * World Bank Pink Sheet data.
 */

export type { HeatmapCell };
export type OilseedsHeatmapRow = CommodityHeatmapRow;
export type OilseedsHeatmapResult = CommodityPriceHeatmapResult;

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  palm_oil: "commodity.palm_oil.cme_futures_price",
};

export async function getOilseedsPriceHeatmap(db: SupabaseClient): Promise<OilseedsHeatmapResult> {
  return getCommodityPriceHeatmapForCategory(db, "Oilseeds", DAILY_SERIES_BY_SLUG);
}

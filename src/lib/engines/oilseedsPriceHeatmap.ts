import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommodityPriceHeatmapForCategory, type CommodityHeatmapRow, type CommodityPriceHeatmapResult, type HeatmapCell } from "./commodityPriceHeatmap";
import { massiveFuturesMetricKey } from "../sources/massiveFutures";

/**
 * Multi-Timeframe Price Heatmap — Oilseeds engine. Thin wrapper around the
 * generalized commodityPriceHeatmap.ts (which this file's original
 * Oilseeds-only implementation was factored out into, so the same
 * methodology now also powers the other commodity-category pages). See
 * that file's doc comment for the full methodology.
 *
 * Short-term (0-30D) is computed for Palm Oil (CME's daily CPO=F futures,
 * commodity.palm_oil.cme_futures_price, tier 3) and, as of this pass, also
 * for Soybeans/Soybean Oil/Soybean Meal (CBOT futures via Massive, tier 3 —
 * see massiveFutures.ts) — the crush complex's own three legs. Every other
 * Oilseeds product (Coconut Oil, Palm Kernel Oil, Rapeseed Oil, Sunflower
 * Oil) still only has monthly World Bank Pink Sheet data.
 */

export type { HeatmapCell };
export type OilseedsHeatmapRow = CommodityHeatmapRow;
export type OilseedsHeatmapResult = CommodityPriceHeatmapResult;

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  palm_oil: "commodity.palm_oil.cme_futures_price",
  soybeans: massiveFuturesMetricKey("soybeans"),
  soybean_oil: massiveFuturesMetricKey("soybean_oil"),
  soybean_meal: massiveFuturesMetricKey("soybean_meal"),
};

export async function getOilseedsPriceHeatmap(db: SupabaseClient): Promise<OilseedsHeatmapResult> {
  return getCommodityPriceHeatmapForCategory(db, "Oilseeds", DAILY_SERIES_BY_SLUG);
}

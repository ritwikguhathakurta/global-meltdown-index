import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommodityPriceCyclesForCategory, type PriceCycle, type PriceCycleResult, type TransitionProbability } from "./commodityPriceCycles";

/**
 * Price Cycle Engine — Oilseeds engine. Thin wrapper around the generalized
 * commodityPriceCycles.ts (which this file's original Oilseeds-only
 * implementation was factored out into, so the same -20%/+20% drawdown
 * methodology and Wilson-CI transition probabilities now also power the
 * other commodity-category pages). See that file's doc comment for the
 * full methodology.
 */

export type { PriceCycle, PriceCycleResult, TransitionProbability };

export async function getOilseedsPriceCycles(db: SupabaseClient): Promise<PriceCycleResult[]> {
  return getCommodityPriceCyclesForCategory(db, "Oilseeds");
}

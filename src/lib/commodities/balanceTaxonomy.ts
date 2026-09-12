/**
 * Global supply-demand balance taxonomy — Commodities engine, Phase 2.
 * Sourced from USDA FAS's Production, Supply and Distribution (PSD) bulk
 * data file (free, no key, no login, updated ~monthly):
 * https://apps.fas.usda.gov/psdonline/downloads/psd_alldata_csv.zip
 *
 * This is a separate namespace from the price taxonomy (taxonomy.ts) —
 * `slug` overlaps with a price commodity's slug where the underlying crop
 * is the same (e.g. "maize", "cotton", "sugar_world") so a future view can
 * join price + balance for that commodity, but several balance-only
 * commodities here (wheat, rice, oats, coffee, pork) have no single-slug
 * price equivalent in taxonomy.ts, since the Pink Sheet/IMF prices for
 * those track a specific benchmark grade (e.g. Wheat US SRW/HRW) rather
 * than the world-aggregate quantity PSD reports.
 *
 * `psdCommodityCode` is PSD's own Commodity_Code column, verified live
 * against the bulk file before use. World totals are computed by summing
 * every reporting country EXCEPT when the same crop is reported both by
 * individual EU member states AND by an EU-bloc aggregate row (codes E2
 * "EU-15", E3 "EU-25", E4 "European Union") in the same year — verified
 * this actually happens for some commodities (Sugar, 2001-2005) but not
 * others (Wheat never reports EU members individually, only the bloc) —
 * see usdaPsd.ts for the per-year, per-commodity resolution logic that
 * avoids both double-counting and silently dropping the EU entirely.
 */

export type BalanceCategory = "Grains" | "Oilseeds" | "Soft Commodities" | "Livestock / Dairy";

export type BalanceCommodityDef = {
  psdCommodityCode: string;
  slug: string;
  label: string;
  category: BalanceCategory;
  unit: string;
};

export const BALANCE_COMMODITIES: BalanceCommodityDef[] = [
  { psdCommodityCode: "0410000", slug: "wheat", label: "Wheat (world)", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "0440000", slug: "maize", label: "Corn (Maize)", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "0422110", slug: "rice", label: "Rice, Milled (world)", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "0430000", slug: "barley", label: "Barley", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "0459200", slug: "sorghum", label: "Sorghum", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "0452000", slug: "oats", label: "Oats", category: "Grains", unit: "million MT" },
  { psdCommodityCode: "2222000", slug: "soybeans", label: "Soybeans", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4232000", slug: "soybean_oil", label: "Soybean Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "0813100", slug: "soybean_meal", label: "Soybean Meal", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4243000", slug: "palm_oil", label: "Palm Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4244000", slug: "palm_kernel_oil", label: "Palm Kernel Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4242000", slug: "coconut_oil", label: "Coconut Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4239100", slug: "rapeseed_oil", label: "Rapeseed Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "4236000", slug: "sunflower_oil", label: "Sunflower Oil", category: "Oilseeds", unit: "million MT" },
  { psdCommodityCode: "2631000", slug: "cotton", label: "Cotton", category: "Soft Commodities", unit: "million 480-lb bales" },
  { psdCommodityCode: "0612000", slug: "sugar_world", label: "Sugar, World", category: "Soft Commodities", unit: "million MT" },
  { psdCommodityCode: "0711100", slug: "coffee", label: "Coffee, Green (world)", category: "Soft Commodities", unit: "million 60kg bags" },
  { psdCommodityCode: "0111000", slug: "beef", label: "Beef", category: "Livestock / Dairy", unit: "million MT (carcass wt.)" },
  { psdCommodityCode: "0115000", slug: "chicken", label: "Chicken", category: "Livestock / Dairy", unit: "million MT" },
  { psdCommodityCode: "0113000", slug: "pork", label: "Pork (Swine)", category: "Livestock / Dairy", unit: "million MT (carcass wt.)" },
];

export const BALANCE_CATEGORIES: BalanceCategory[] = ["Grains", "Oilseeds", "Soft Commodities", "Livestock / Dairy"];

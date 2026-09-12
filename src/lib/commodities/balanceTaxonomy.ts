/**
 * Global supply-demand balance taxonomy — Commodities engine, Phase 2.
 * Three free, no-key sources feed this:
 *
 *  - USDA FAS Production, Supply and Distribution (PSD) bulk data file —
 *    production/consumption/ending-stocks for 20 agricultural commodities,
 *    annual: https://apps.fas.usda.gov/psdonline/downloads/psd_alldata_csv.zip
 *    See usdaPsd.ts. `sourceCode` is PSD's Commodity_Code.
 *  - FAOSTAT bulk "Production_Crops_Livestock" data file — production only
 *    (FAOSTAT does not publish consumption/stocks in this domain) for four
 *    commodities PSD doesn't cover but this app already prices (Cocoa, Tea,
 *    Rubber, Tobacco): https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data.zip
 *    See faostat.ts. `sourceCode` is FAOSTAT's Item Code. Its "World"
 *    row (Area Code 5000) is a pre-computed aggregate — no EU-style
 *    double-counting risk the way PSD had.
 *  - EIA international dataset's own "World" region aggregate (countryRegionId
 *    "WORL") — production/consumption for Crude Oil, Natural Gas, and Coal,
 *    annual. See eiaWorldEnergy.ts. `sourceCode` is `${productId}:${activityId}`.
 *
 * This is a separate namespace from the price taxonomy (taxonomy.ts) —
 * `slug` overlaps with a price commodity's slug where the underlying
 * commodity is the same (e.g. "maize", "cotton", "sugar_world", "cocoa")
 * so a future view can join price + balance for that commodity, but most
 * balance-only commodities here (wheat, rice, oats, coffee, pork, tea,
 * rubber, tobacco, and all three Energy entries) have no single-slug price
 * equivalent in taxonomy.ts, since the Pink Sheet/IMF prices for those
 * track a specific benchmark grade (e.g. Wheat US SRW/HRW, Brent crude)
 * rather than the world-aggregate quantity these sources report.
 */

export type BalanceCategory = "Energy" | "Grains" | "Oilseeds" | "Soft Commodities" | "Livestock / Dairy";
export type BalanceSource = "usda_psd" | "faostat" | "eia_world_energy";

export type BalanceCommodityDef = {
  source: BalanceSource;
  sourceCode: string;
  slug: string;
  label: string;
  category: BalanceCategory;
  unit: string;
  /** true if this source only reports production (no consumption/ending stocks) */
  productionOnly?: boolean;
};

export const BALANCE_COMMODITIES: BalanceCommodityDef[] = [
  // Energy — EIA international dataset, World aggregate (countryRegionId=WORL).
  // None of these reuse a price slug from taxonomy.ts: EIA has no "crude
  // oil consumption" concept at all (crude isn't consumed directly, it's
  // refined first — verified live, the query returns zero rows), so a
  // matching production+consumption pair only exists at the broader
  // "Total petroleum and other liquids" / "Refined petroleum products"
  // level (the same convention eiaApi.ts already uses for country-level
  // balances) — reusing "crude_oil_average" here would conflate that
  // broader basket (includes NGLs, biofuels, refinery processing gains)
  // with the Pink Sheet's actual Brent/Dubai/WTI crude price average.
  // Natural gas and coal similarly have no single-world price benchmark in
  // taxonomy.ts (only regional ones — Henry Hub, TTF, Newcastle, API4).
  { source: "eia_world_energy", sourceCode: "crude_oil", slug: "petroleum_liquids_world", label: "Petroleum & Other Liquids (world)", category: "Energy", unit: "million bbl/day" },
  { source: "eia_world_energy", sourceCode: "natural_gas", slug: "natural_gas_world", label: "Natural Gas (world)", category: "Energy", unit: "trillion cubic feet/yr" },
  { source: "eia_world_energy", sourceCode: "coal", slug: "coal_world", label: "Coal (world)", category: "Energy", unit: "billion MT/yr" },

  // Grains — USDA PSD
  { source: "usda_psd", sourceCode: "0410000", slug: "wheat", label: "Wheat (world)", category: "Grains", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0440000", slug: "maize", label: "Corn (Maize)", category: "Grains", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0422110", slug: "rice", label: "Rice, Milled (world)", category: "Grains", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0430000", slug: "barley", label: "Barley", category: "Grains", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0459200", slug: "sorghum", label: "Sorghum", category: "Grains", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0452000", slug: "oats", label: "Oats", category: "Grains", unit: "million MT" },

  // Oilseeds — USDA PSD
  { source: "usda_psd", sourceCode: "2222000", slug: "soybeans", label: "Soybeans", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4232000", slug: "soybean_oil", label: "Soybean Oil", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0813100", slug: "soybean_meal", label: "Soybean Meal", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4243000", slug: "palm_oil", label: "Palm Oil", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4244000", slug: "palm_kernel_oil", label: "Palm Kernel Oil", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4242000", slug: "coconut_oil", label: "Coconut Oil", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4239100", slug: "rapeseed_oil", label: "Rapeseed Oil", category: "Oilseeds", unit: "million MT" },
  { source: "usda_psd", sourceCode: "4236000", slug: "sunflower_oil", label: "Sunflower Oil", category: "Oilseeds", unit: "million MT" },

  // Soft Commodities — USDA PSD + FAOSTAT (production only)
  { source: "usda_psd", sourceCode: "2631000", slug: "cotton", label: "Cotton", category: "Soft Commodities", unit: "million 480-lb bales" },
  { source: "usda_psd", sourceCode: "0612000", slug: "sugar_world", label: "Sugar, World", category: "Soft Commodities", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0711100", slug: "coffee", label: "Coffee, Green (world)", category: "Soft Commodities", unit: "million 60kg bags" },
  { source: "faostat", sourceCode: "661", slug: "cocoa", label: "Cocoa Beans (world)", category: "Soft Commodities", unit: "million MT", productionOnly: true },
  { source: "faostat", sourceCode: "667", slug: "tea", label: "Tea Leaves (world)", category: "Soft Commodities", unit: "million MT", productionOnly: true },
  { source: "faostat", sourceCode: "836", slug: "rubber", label: "Natural Rubber (world)", category: "Soft Commodities", unit: "million MT", productionOnly: true },
  { source: "faostat", sourceCode: "826", slug: "tobacco", label: "Unmanufactured Tobacco (world)", category: "Soft Commodities", unit: "million MT", productionOnly: true },

  // Livestock / Dairy — USDA PSD
  { source: "usda_psd", sourceCode: "0111000", slug: "beef", label: "Beef", category: "Livestock / Dairy", unit: "million MT (carcass wt.)" },
  { source: "usda_psd", sourceCode: "0115000", slug: "chicken", label: "Chicken", category: "Livestock / Dairy", unit: "million MT" },
  { source: "usda_psd", sourceCode: "0113000", slug: "pork", label: "Pork (Swine)", category: "Livestock / Dairy", unit: "million MT (carcass wt.)" },
];

export const BALANCE_CATEGORIES: BalanceCategory[] = ["Energy", "Grains", "Oilseeds", "Soft Commodities", "Livestock / Dairy"];

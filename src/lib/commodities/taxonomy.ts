/**
 * Canonical commodity taxonomy for the Commodities engine, built against the
 * ~115-section Commodity Intelligence Platform spec. Every entry here is a
 * real, live series confirmed in the World Bank Pink Sheet (CMO-Historical-
 * Data-Monthly.xlsx, monthly since 1960, free, no key) — see
 * worldBankCommodities.ts. `pinkSheetColumn` is the 1-indexed column that
 * series occupies in that workbook's "Monthly Prices" sheet, verified live
 * against the file's own header row rather than guessed.
 *
 * This intentionally follows the existing app's config-in-code pattern
 * (matching EIA_COUNTRIES, FRED_SERIES, TRADE_COMMODITIES elsewhere) rather
 * than a new database-driven metadata table — the spec's own §113 says to
 * adapt to whatever architecture already exists in the repository rather
 * than introduce a parallel one.
 *
 * Categories not represented here (Critical Minerals — Lithium/Cobalt/
 * Graphite/Manganese/Rare Earths/Vanadium/Tungsten/Molybdenum — and the
 * OPEC Basket) were checked directly against the Pink Sheet and have no
 * column; disclosed as a gap on the Commodities dashboard rather than
 * substituted or estimated.
 */

export type CommodityCategory =
  | "Energy"
  | "Base Metals"
  | "Precious Metals"
  | "Grains"
  | "Oilseeds"
  | "Soft Commodities"
  | "Livestock / Dairy"
  | "Fertilizers"
  | "Forestry / Other Raw Materials";

export type CommodityDef = {
  slug: string;
  label: string;
  category: CommodityCategory;
  unit: string;
  pinkSheetColumn: number;
};

export const COMMODITIES: CommodityDef[] = [
  // Energy
  { slug: "crude_oil_average", label: "Crude Oil (Average)", category: "Energy", unit: "$/bbl", pinkSheetColumn: 1 },
  { slug: "brent_crude", label: "Brent Crude", category: "Energy", unit: "$/bbl", pinkSheetColumn: 2 },
  { slug: "dubai_crude", label: "Dubai/Oman Crude", category: "Energy", unit: "$/bbl", pinkSheetColumn: 3 },
  { slug: "wti_crude", label: "WTI Crude", category: "Energy", unit: "$/bbl", pinkSheetColumn: 4 },
  { slug: "coal_australian", label: "Coal, Australian (Newcastle)", category: "Energy", unit: "$/mt", pinkSheetColumn: 5 },
  { slug: "coal_south_african", label: "Coal, South African (API4)", category: "Energy", unit: "$/mt", pinkSheetColumn: 6 },
  { slug: "natural_gas_us", label: "Natural Gas, US (Henry Hub)", category: "Energy", unit: "$/mmbtu", pinkSheetColumn: 7 },
  { slug: "natural_gas_europe", label: "Natural Gas, Europe (TTF)", category: "Energy", unit: "$/mmbtu", pinkSheetColumn: 8 },
  { slug: "lng_japan", label: "LNG, Japan (JKM proxy)", category: "Energy", unit: "$/mmbtu", pinkSheetColumn: 9 },

  // Soft commodities (beverages/tropical)
  { slug: "cocoa", label: "Cocoa", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 11 },
  { slug: "coffee_arabica", label: "Coffee, Arabica", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 12 },
  { slug: "coffee_robusta", label: "Coffee, Robusta", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 13 },
  { slug: "tea_avg", label: "Tea (avg 3 auctions)", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 14 },
  { slug: "cotton", label: "Cotton, A Index", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 54 },
  { slug: "rubber_tsr20", label: "Rubber, TSR20", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 55 },

  // Oilseeds
  { slug: "coconut_oil", label: "Coconut Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 18 },
  { slug: "palm_oil", label: "Palm Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 22 },
  { slug: "palm_kernel_oil", label: "Palm Kernel Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 23 },
  { slug: "soybeans", label: "Soybeans", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 24 },
  { slug: "soybean_oil", label: "Soybean Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 25 },
  { slug: "soybean_meal", label: "Soybean Meal", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 26 },
  { slug: "rapeseed_oil", label: "Rapeseed Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 27 },
  { slug: "sunflower_oil", label: "Sunflower Oil", category: "Oilseeds", unit: "$/mt", pinkSheetColumn: 28 },

  // Grains
  { slug: "barley", label: "Barley", category: "Grains", unit: "$/mt", pinkSheetColumn: 29 },
  { slug: "maize", label: "Corn (Maize)", category: "Grains", unit: "$/mt", pinkSheetColumn: 30 },
  { slug: "sorghum", label: "Sorghum", category: "Grains", unit: "$/mt", pinkSheetColumn: 31 },
  { slug: "rice_thai_5pct", label: "Rice, Thai 5%", category: "Grains", unit: "$/mt", pinkSheetColumn: 32 },
  { slug: "wheat_us_srw", label: "Wheat, US SRW", category: "Grains", unit: "$/mt", pinkSheetColumn: 36 },
  { slug: "wheat_us_hrw", label: "Wheat, US HRW", category: "Grains", unit: "$/mt", pinkSheetColumn: 37 },

  // Livestock / dairy / other food
  { slug: "beef", label: "Beef", category: "Livestock / Dairy", unit: "$/kg", pinkSheetColumn: 41 },
  { slug: "chicken", label: "Chicken", category: "Livestock / Dairy", unit: "$/kg", pinkSheetColumn: 42 },
  { slug: "lamb", label: "Lamb", category: "Livestock / Dairy", unit: "$/kg", pinkSheetColumn: 43 },
  { slug: "sugar_world", label: "Sugar, World", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 47 },
  { slug: "bananas_us", label: "Bananas, US", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 39 },
  { slug: "oranges", label: "Oranges", category: "Soft Commodities", unit: "$/kg", pinkSheetColumn: 40 },

  // Forestry / other raw materials
  { slug: "logs_cameroon", label: "Logs, Cameroon", category: "Forestry / Other Raw Materials", unit: "$/m3", pinkSheetColumn: 49 },
  { slug: "logs_malaysian", label: "Logs, Malaysian", category: "Forestry / Other Raw Materials", unit: "$/m3", pinkSheetColumn: 50 },
  { slug: "tobacco_us", label: "Tobacco, US Import", category: "Forestry / Other Raw Materials", unit: "$/mt", pinkSheetColumn: 48 },

  // Fertilizers
  { slug: "phosphate_rock", label: "Phosphate Rock", category: "Fertilizers", unit: "$/mt", pinkSheetColumn: 57 },
  { slug: "dap", label: "DAP", category: "Fertilizers", unit: "$/mt", pinkSheetColumn: 58 },
  { slug: "tsp", label: "TSP", category: "Fertilizers", unit: "$/mt", pinkSheetColumn: 59 },
  { slug: "urea", label: "Urea", category: "Fertilizers", unit: "$/mt", pinkSheetColumn: 60 },
  { slug: "potassium_chloride", label: "Potash (Potassium Chloride)", category: "Fertilizers", unit: "$/mt", pinkSheetColumn: 61 },

  // Base metals
  { slug: "aluminum", label: "Aluminium", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 62 },
  { slug: "iron_ore", label: "Iron Ore", category: "Base Metals", unit: "$/dmtu", pinkSheetColumn: 63 },
  { slug: "copper", label: "Copper", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 64 },
  { slug: "lead", label: "Lead", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 65 },
  { slug: "tin", label: "Tin", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 66 },
  { slug: "nickel", label: "Nickel", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 67 },
  { slug: "zinc", label: "Zinc", category: "Base Metals", unit: "$/mt", pinkSheetColumn: 68 },

  // Precious metals
  { slug: "gold", label: "Gold", category: "Precious Metals", unit: "$/troy oz", pinkSheetColumn: 69 },
  { slug: "platinum", label: "Platinum", category: "Precious Metals", unit: "$/troy oz", pinkSheetColumn: 70 },
  { slug: "silver", label: "Silver", category: "Precious Metals", unit: "$/troy oz", pinkSheetColumn: 71 },
];

export const COMMODITY_CATEGORIES: CommodityCategory[] = [
  "Energy",
  "Base Metals",
  "Precious Metals",
  "Grains",
  "Oilseeds",
  "Soft Commodities",
  "Livestock / Dairy",
  "Fertilizers",
  "Forestry / Other Raw Materials",
];

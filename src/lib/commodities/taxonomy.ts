/**
 * Canonical commodity taxonomy for the Commodities engine, built against the
 * ~115-section Commodity Intelligence Platform spec. Two live, free, no-key
 * sources feed this taxonomy:
 *
 *  - World Bank Pink Sheet (CMO-Historical-Data-Monthly.xlsx, monthly since
 *    1960) — see worldBankCommodities.ts. `pinkSheetColumn` is the 1-indexed
 *    column that series occupies in that workbook's "Monthly Prices" sheet,
 *    verified live against the file's own header row rather than guessed.
 *  - IMF Primary Commodity Price System (PCPS), mirrored free/no-auth via
 *    DBnomics (db.nomics.world) — see dbnomicsCriticalMinerals.ts. IMF's own
 *    API endpoints for this (dataservices.imf.org, api.imf.org/.../sdmx/3.0)
 *    were checked live and are dead/404; DBnomics' mirror of the same
 *    underlying PCPS dataset is live and was verified series-by-series
 *    against IMF's own published "Table 3" unit documentation and known
 *    market price levels before use. `dbnomicsSeriesCode` is the DBnomics
 *    series code within dataset IMF/PCPS.
 *
 * This intentionally follows the existing app's config-in-code pattern
 * (matching EIA_COUNTRIES, FRED_SERIES, TRADE_COMMODITIES elsewhere) rather
 * than a new database-driven metadata table — the spec's own §113 says to
 * adapt to whatever architecture already exists in the repository rather
 * than introduce a parallel one.
 *
 * Genuinely still missing, checked directly and confirmed absent from both
 * sources above (not substituted or estimated): Graphite, Tungsten, and a
 * distinct OPEC Reference Basket series (EIA v2 publishes Brent/WTI/Dubai
 * only — no ORB; opec.org's own ORB page returns HTTP 403 to unauthenticated
 * fetches).
 */

export type CommodityCategory =
  | "Energy"
  | "Base Metals"
  | "Precious Metals"
  | "Critical Minerals"
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
  source: "world_bank" | "imf_pcps_dbnomics";
  pinkSheetColumn?: number;
  dbnomicsSeriesCode?: string;
};

export const COMMODITIES: CommodityDef[] = [
  // Energy
  { slug: "crude_oil_average", label: "Crude Oil (Average)", category: "Energy", unit: "$/bbl", source: "world_bank", pinkSheetColumn: 1 },
  { slug: "brent_crude", label: "Brent Crude", category: "Energy", unit: "$/bbl", source: "world_bank", pinkSheetColumn: 2 },
  { slug: "dubai_crude", label: "Dubai/Oman Crude", category: "Energy", unit: "$/bbl", source: "world_bank", pinkSheetColumn: 3 },
  { slug: "wti_crude", label: "WTI Crude", category: "Energy", unit: "$/bbl", source: "world_bank", pinkSheetColumn: 4 },
  { slug: "coal_australian", label: "Coal, Australian (Newcastle)", category: "Energy", unit: "$/mt", source: "world_bank", pinkSheetColumn: 5 },
  { slug: "coal_south_african", label: "Coal, South African (API4)", category: "Energy", unit: "$/mt", source: "world_bank", pinkSheetColumn: 6 },
  { slug: "natural_gas_us", label: "Natural Gas, US (Henry Hub)", category: "Energy", unit: "$/mmbtu", source: "world_bank", pinkSheetColumn: 7 },
  { slug: "natural_gas_europe", label: "Natural Gas, Europe (TTF)", category: "Energy", unit: "$/mmbtu", source: "world_bank", pinkSheetColumn: 8 },
  { slug: "lng_japan", label: "LNG, Japan (JKM proxy)", category: "Energy", unit: "$/mmbtu", source: "world_bank", pinkSheetColumn: 9 },

  // Soft commodities (beverages/tropical)
  { slug: "cocoa", label: "Cocoa", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 11 },
  { slug: "coffee_arabica", label: "Coffee, Arabica", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 12 },
  { slug: "coffee_robusta", label: "Coffee, Robusta", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 13 },
  { slug: "tea_avg", label: "Tea (avg 3 auctions)", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 14 },
  { slug: "cotton", label: "Cotton, A Index", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 54 },
  { slug: "rubber_tsr20", label: "Rubber, TSR20", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 55 },

  // Oilseeds
  { slug: "coconut_oil", label: "Coconut Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 18 },
  { slug: "palm_oil", label: "Palm Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 22 },
  { slug: "palm_kernel_oil", label: "Palm Kernel Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 23 },
  { slug: "soybeans", label: "Soybeans", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 24 },
  { slug: "soybean_oil", label: "Soybean Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 25 },
  { slug: "soybean_meal", label: "Soybean Meal", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 26 },
  { slug: "rapeseed_oil", label: "Rapeseed Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 27 },
  { slug: "sunflower_oil", label: "Sunflower Oil", category: "Oilseeds", unit: "$/mt", source: "world_bank", pinkSheetColumn: 28 },

  // Grains
  { slug: "barley", label: "Barley", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 29 },
  { slug: "maize", label: "Corn (Maize)", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 30 },
  { slug: "sorghum", label: "Sorghum", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 31 },
  { slug: "rice_thai_5pct", label: "Rice, Thai 5%", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 32 },
  { slug: "wheat_us_srw", label: "Wheat, US SRW", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 36 },
  { slug: "wheat_us_hrw", label: "Wheat, US HRW", category: "Grains", unit: "$/mt", source: "world_bank", pinkSheetColumn: 37 },

  // Livestock / dairy / other food
  { slug: "beef", label: "Beef", category: "Livestock / Dairy", unit: "$/kg", source: "world_bank", pinkSheetColumn: 41 },
  { slug: "chicken", label: "Chicken", category: "Livestock / Dairy", unit: "$/kg", source: "world_bank", pinkSheetColumn: 42 },
  { slug: "lamb", label: "Lamb", category: "Livestock / Dairy", unit: "$/kg", source: "world_bank", pinkSheetColumn: 43 },
  { slug: "sugar_world", label: "Sugar, World", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 47 },
  { slug: "bananas_us", label: "Bananas, US", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 39 },
  { slug: "oranges", label: "Oranges", category: "Soft Commodities", unit: "$/kg", source: "world_bank", pinkSheetColumn: 40 },

  // Forestry / other raw materials
  { slug: "logs_cameroon", label: "Logs, Cameroon", category: "Forestry / Other Raw Materials", unit: "$/m3", source: "world_bank", pinkSheetColumn: 49 },
  { slug: "logs_malaysian", label: "Logs, Malaysian", category: "Forestry / Other Raw Materials", unit: "$/m3", source: "world_bank", pinkSheetColumn: 50 },
  { slug: "tobacco_us", label: "Tobacco, US Import", category: "Forestry / Other Raw Materials", unit: "$/mt", source: "world_bank", pinkSheetColumn: 48 },

  // Fertilizers
  { slug: "phosphate_rock", label: "Phosphate Rock", category: "Fertilizers", unit: "$/mt", source: "world_bank", pinkSheetColumn: 57 },
  { slug: "dap", label: "DAP", category: "Fertilizers", unit: "$/mt", source: "world_bank", pinkSheetColumn: 58 },
  { slug: "tsp", label: "TSP", category: "Fertilizers", unit: "$/mt", source: "world_bank", pinkSheetColumn: 59 },
  { slug: "urea", label: "Urea", category: "Fertilizers", unit: "$/mt", source: "world_bank", pinkSheetColumn: 60 },
  { slug: "potassium_chloride", label: "Potash (Potassium Chloride)", category: "Fertilizers", unit: "$/mt", source: "world_bank", pinkSheetColumn: 61 },

  // Base metals
  { slug: "aluminum", label: "Aluminium", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 62 },
  { slug: "iron_ore", label: "Iron Ore", category: "Base Metals", unit: "$/dmtu", source: "world_bank", pinkSheetColumn: 63 },
  { slug: "copper", label: "Copper", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 64 },
  { slug: "lead", label: "Lead", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 65 },
  { slug: "tin", label: "Tin", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 66 },
  { slug: "nickel", label: "Nickel", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 67 },
  { slug: "zinc", label: "Zinc", category: "Base Metals", unit: "$/mt", source: "world_bank", pinkSheetColumn: 68 },

  // Precious metals
  { slug: "gold", label: "Gold", category: "Precious Metals", unit: "$/troy oz", source: "world_bank", pinkSheetColumn: 69 },
  { slug: "platinum", label: "Platinum", category: "Precious Metals", unit: "$/troy oz", source: "world_bank", pinkSheetColumn: 70 },
  { slug: "silver", label: "Silver", category: "Precious Metals", unit: "$/troy oz", source: "world_bank", pinkSheetColumn: 71 },

  // Critical minerals — IMF PCPS via DBnomics (dataset IMF/PCPS, monthly,
  // series codes M.W00.<code>.USD). Units confirmed against IMF's own
  // "Table 3" documentation (Cobalt, Molybdenum: $/mt) or, for the two
  // series absent from that table (Vanadium, Rare Earth Elements), against
  // known market price levels for the named benchmark (PVANPENT = vanadium
  // pentoxide; PREODOM = a rare-earth-oxide basket) before use.
  { slug: "cobalt", label: "Cobalt", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PCOBA" },
  { slug: "lithium", label: "Lithium", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PLITH" },
  { slug: "manganese", label: "Manganese", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PMANGELE" },
  { slug: "molybdenum", label: "Molybdenum", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PLMMODY" },
  { slug: "vanadium_pentoxide", label: "Vanadium Pentoxide", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PVANPENT" },
  { slug: "rare_earth_elements", label: "Rare Earth Elements (basket)", category: "Critical Minerals", unit: "$/mt", source: "imf_pcps_dbnomics", dbnomicsSeriesCode: "PREODOM" },
];

export const COMMODITY_CATEGORIES: CommodityCategory[] = [
  "Energy",
  "Base Metals",
  "Precious Metals",
  "Critical Minerals",
  "Grains",
  "Oilseeds",
  "Soft Commodities",
  "Livestock / Dairy",
  "Fertilizers",
  "Forestry / Other Raw Materials",
];

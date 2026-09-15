import { CommodityCategoryPage } from "../_components";

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  lithium: "commodity.lithium.etf_proxy_price",
  rare_earth_elements: "commodity.rare_earth_elements.etf_proxy_price",
};

export default async function CriticalMineralsPage() {
  return CommodityCategoryPage({
    category: "Critical Minerals",
    slug: "critical-minerals",
    title: "Critical Minerals",
    intro:
      "Cobalt, Lithium, Manganese, Molybdenum, Vanadium Pentoxide, and a Rare Earth Elements basket — price momentum from IMF PCPS prices (via DBnomics), world mine production (USGS), country-level production for the top producers of each, a multi-timeframe momentum heatmap, and a price cycle engine. These IMF PCPS price series are much shorter than the Pink Sheet's 1960 start, so cycle and heatmap reads here should be read as thinner than the older commodity categories.",
    dailySeriesMetricKeyBySlug: DAILY_SERIES_BY_SLUG,
    countryBalanceCategory: "Critical Minerals",
    seasonalityNote:
      "Not built. USGS's Mineral Commodity Summaries only publishes the current + prior year, not a multi-year monthly series — there's no genuine seasonal curve to compute from it.",
    disclosureReal:
      "IMF Primary Commodity Price System prices (mirrored free via DBnomics) for Cobalt, Lithium, Manganese, Molybdenum, Vanadium Pentoxide, and a Rare Earth Elements basket; world and country-level mine production (top 4-10 producing countries each, live-verified against USGS's own MCS2026 bulk data release) for all six, with year-over-year change; Short-Term (0-30D) heatmap cells for Lithium and Rare Earth Elements via liquid ETF proxies (LIT, a battery-metals ETF; REMX, a rare-earth/strategic-metals miner ETF) — disclosed as equity/ETF proxies, not a direct spot commodity price, since neither has a genuine futures contract; a price-cycle engine and a Multi-Timeframe Price Heatmap using whatever price history each series genuinely has; and real country-level Imports/Exports/Net Trade/Apparent Consumption/Classification via UN Comtrade for all six, for the countries that report usable trade data. Lithium's trade figure is shown in lithium-carbonate mass (its dominant traded compound, HS 283691) rather than the elemental-lithium-content basis USGS uses for production — Chile's ~220K tonnes of carbonate exports correctly converts to roughly the same ~42K tonnes of contained lithium as its ~56K tonne production, but looks larger side by side without that conversion, which isn't performed here (it would mean assuming a carbonate purity this app has no per-shipment basis for).",
    disclosureNotBuilt:
      "Short-Term (0-30D) momentum for Cobalt, Manganese, Molybdenum, and Vanadium Pentoxide — checked live and confirmed to have no working Yahoo Finance ticker or plausible ETF proxy, so those cells read N/A. Imports/Exports for DRC's cobalt specifically — the world's dominant producer, but confirmed live to barely report to Comtrade at all (its own total-trade row comes back mirror-estimated with no weight), so its trade figure here is a real but significant undercount, not a data error. Ending Stocks / Stocks-to-Use for all six — no free country-level source was found. Production & Export Seasonality — MCS only publishes two years per commodity. Graphite, Tungsten, and a distinct OPEC-style basket for minerals were already checked and confirmed absent from both World Bank and IMF PCPS sources (see the main Commodities page's own taxonomy notes).",
  });
}

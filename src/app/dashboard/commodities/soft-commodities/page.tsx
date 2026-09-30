import { CommodityCategoryPage } from "../_components";

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  cocoa: "commodity.cocoa.daily_futures_price",
  coffee_arabica: "commodity.coffee_arabica.daily_futures_price",
  sugar_world: "commodity.sugar_world.daily_futures_price",
  cotton: "commodity.cotton.daily_futures_price",
};

export default async function SoftCommoditiesPage() {
  return CommodityCategoryPage({
    category: "Soft Commodities",
    slug: "soft-commodities",
    title: "Soft Commodities",
    intro:
      "Cocoa, Coffee (Arabica/Robusta), Tea, Cotton, Rubber, Sugar, Bananas, and Oranges — price momentum, world supply-demand balances, country-level balance sheets for Cotton/Sugar/Coffee, a multi-timeframe momentum heatmap, and a long-run price cycle engine. See the disclosure at the bottom for what's real here and what genuinely isn't built.",
    countryBalanceCategory: "Soft Commodities",
    dailySeriesMetricKeyBySlug: DAILY_SERIES_BY_SLUG,
    seasonalityNote:
      "Not built. A genuine seasonality index needs monthly production or export data; USDA PSD (Cotton/Sugar/Coffee) and FAOSTAT (Cocoa/Tea/Rubber/Tobacco) both only publish annual figures, and no free monthly country-level source has been verified live for any of these yet.",
    disclosureReal:
      "World Bank Pink Sheet prices for Cocoa, Coffee (Arabica & Robusta), Tea (3-auction average), Cotton (A Index), Rubber (TSR20), Sugar (World), Bananas (US), and Oranges — monthly since 1960; USDA FAS PSD world-level annual balances for Cotton, Sugar, and Coffee, plus FAOSTAT production-only figures for Cocoa, Tea, Rubber, and Tobacco (FAOSTAT doesn't publish consumption/stocks in this domain, so those three columns are genuinely absent for the FAOSTAT-sourced four, not hidden); country-level balance sheets — production, imports, exports, ending stocks, apparent consumption, stocks/use, exporter/importer classification, and export HHI — for the top producers of Cotton, Sugar, and Coffee, computed from the USDA PSD bulk file with live-verified country codes and rankings, same methodology as the Oilseeds engine's Soybean Country Balance Sheet; live daily futures prices for Cocoa (ICE CC=F), Coffee Arabica (ICE KC=F), Sugar (ICE SB=F), and Cotton (ICE CT=F) feeding genuine Short-Term (0-30D) heatmap cells for those four — Cotton's futures price (No. 2 contract) is a real, actively-traded proxy for the Cotlook A Index priced above, not the identical index; a price-cycle engine covering all nine Soft-Commodities-category products since 1960; and a Multi-Timeframe Price Heatmap.",
    disclosureNotBuilt:
      "Short-Term (0-30D) momentum for Coffee Robusta, Tea, Rubber, Bananas, and Oranges — no free daily futures feed exists for Robusta on Yahoo Finance, and Tea/Rubber/Bananas/Oranges have no futures contract at all (Orange Juice concentrate futures exist but price a different processed product, so weren't substituted in) — those Short-Term cells read N/A rather than using a fabricated proxy. Production & Export Seasonality — see the note above. Country-level balance sheets for Cocoa, Tea, Rubber, and Tobacco — FAOSTAT's production-only figures don't support the same imports/exports/stocks identity used for Cotton/Sugar/Coffee, and a country breakdown of just the production figure wasn't built this pass.",
  });
}

import { CommodityCategoryPage } from "../_components";

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  gold: "commodity.gold.daily_futures_price",
  silver: "commodity.silver.daily_futures_price",
  platinum: "commodity.platinum.daily_futures_price",
};

export default async function PreciousMetalsPage() {
  return CommodityCategoryPage({
    category: "Precious Metals",
    slug: "precious-metals",
    title: "Precious Metals",
    intro:
      "Gold, Platinum, and Silver — price momentum, world mine production (USGS), country-level production for the top producers of each, a multi-timeframe momentum heatmap with real daily futures prices for all three, and a long-run price cycle engine.",
    dailySeriesMetricKeyBySlug: DAILY_SERIES_BY_SLUG,
    countryBalanceCategory: "Precious Metals",
    seasonalityNote:
      "Not built. USGS's Mineral Commodity Summaries only publishes the current + prior year, not a multi-year monthly series — there's no genuine seasonal curve to compute from it.",
    disclosureReal:
      "World Bank Pink Sheet prices for Gold, Platinum, and Silver — monthly since 1960; world and country-level mine production (top 5-10 producing countries each, live-verified against USGS's own MCS2026 bulk data release) for all three, with year-over-year change; live daily futures prices (COMEX GC=F, SI=F, PL=F) feeding genuine Short-Term (0-30D) heatmap cells for all three products; a price-cycle engine covering all three since 1960; a Multi-Timeframe Price Heatmap; and real country-level Imports/Exports/Net Trade/Apparent Consumption/Classification via UN Comtrade for the countries that report a trade weight for these metals (e.g. the US for gold, Russia for platinum, China/Peru for silver).",
    disclosureNotBuilt:
      "Imports/Exports for South Africa's platinum and Mexico's silver specifically — checked live: both report trade VALUE to Comtrade for these metals but not a physical WEIGHT, so no reliable metric-ton figure exists even though these are each metal's single largest producer; shown as \"—\", not estimated from value. Ending Stocks / Stocks-to-Use — no free country-level source exists (central-bank gold reserves are a different concept, not comparable to a commodity-market ending-stocks figure, so not substituted here). Production & Export Seasonality — MCS only publishes two years per commodity, not a multi-year monthly series.",
  });
}

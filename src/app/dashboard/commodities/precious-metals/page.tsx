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
      "World Bank Pink Sheet prices for Gold, Platinum, and Silver — monthly since 1960; world and country-level mine production (top 5-10 producing countries each, live-verified against USGS's own MCS2026 bulk data release) for all three, with year-over-year change; live daily futures prices (COMEX GC=F, SI=F, PL=F) feeding genuine Short-Term (0-30D) heatmap cells for all three products; a price-cycle engine covering all three since 1960; and a Multi-Timeframe Price Heatmap.",
    disclosureNotBuilt:
      "A full balance sheet (imports/exports/consumption/ending-stocks/classification) — USGS's MCS bulk file is production-only, so the Country Balance Sheet above only shows production and YoY, not a trade identity. Production & Export Seasonality — MCS only publishes two years per commodity, not a multi-year monthly series.",
  });
}

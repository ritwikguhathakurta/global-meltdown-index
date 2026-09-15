import { CommodityCategoryPage } from "../_components";

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  copper: "commodity.copper.daily_futures_price",
  aluminum: "commodity.aluminum.daily_futures_price",
  zinc: "commodity.zinc.daily_futures_price",
  iron_ore: "commodity.iron_ore.daily_futures_price",
};

export default async function BaseMetalsPage() {
  return CommodityCategoryPage({
    category: "Base Metals",
    slug: "base-metals",
    title: "Base Metals",
    intro:
      "Aluminium, Iron Ore, Copper, Lead, Tin, Nickel, and Zinc — price momentum, world mine/smelter production (USGS), country-level production for the top 8-10 producers of each, a multi-timeframe momentum heatmap (with real daily prices for four of the seven), and a long-run price cycle engine.",
    dailySeriesMetricKeyBySlug: DAILY_SERIES_BY_SLUG,
    countryBalanceCategory: "Base Metals",
    seasonalityNote:
      "Not built. USGS's Mineral Commodity Summaries only publishes the current + prior year, not a multi-year monthly series — there's no genuine seasonal curve to compute from it.",
    disclosureReal:
      "World Bank Pink Sheet prices for Aluminium, Iron Ore, Copper, Lead, Tin, Nickel, and Zinc — monthly since 1960; world and country-level mine/smelter production (top 8-10 producing countries each, live-verified against USGS's own MCS2026 bulk data release — country codes aren't a PSD-style code here, just the exact country names USGS itself reports) for all seven, with year-over-year change; live daily futures prices for Copper (COMEX HG=F), Aluminium (COMEX ALI=F), Zinc (COMEX ZNC=F), and Iron Ore (SGX/TSI-linked TIO=F) feeding genuine Short-Term (0-30D) heatmap cells for those four — Lead, Tin, and Nickel were checked live and confirmed to have no working Yahoo Finance ticker, so their Short-Term cells read N/A rather than using a fabricated proxy; a price-cycle engine covering all seven products since 1960; a Multi-Timeframe Price Heatmap; and real country-level Imports/Exports/Net Trade/Apparent Consumption/Classification via UN Comtrade for all seven, filling in USGS's production-only gap. Each metal's HS trade code was live-verified as its dominant traded product FORM (e.g. unwrought metal for Tin/Lead/Zinc/Aluminium, ore/concentrate for Iron Ore), not a contained-metal-equivalent conversion — a country that processes ore into a different form before export can show a trade figure well below its mine-production tonnage (confirmed for Indonesia/Philippines nickel: they convert most mine output into stainless steel/battery inputs domestically rather than exporting unwrought metal, so their real export share reads small, not broken).",
    disclosureNotBuilt:
      "Ending Stocks / Stocks-to-Use for base metals — no free country-level warehouse-stock source was found for any of these seven (LME publishes global, not country-level, warehouse stocks); Classification and Net Trade above are still real, computed from real Production/Imports/Exports. Production & Export Seasonality — MCS only publishes two years per commodity, not a multi-year monthly series.",
  });
}

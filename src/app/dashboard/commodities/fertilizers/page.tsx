import { CommodityCategoryPage } from "../_components";

export default async function FertilizersPage() {
  return CommodityCategoryPage({
    category: "Fertilizers",
    slug: "fertilizers",
    title: "Fertilizers",
    intro:
      "Phosphate Rock, DAP, TSP, Urea, and Potash — price momentum, world mine production and country-level production for Phosphate Rock and Potash (via USGS), a multi-timeframe momentum heatmap, and a long-run price cycle engine.",
    countryBalanceCategory: "Fertilizers",
    seasonalityNote:
      "Not built. USGS's Mineral Commodity Summaries only publishes the current + prior year, not a multi-year monthly series — there's no genuine seasonal curve to compute from it.",
    disclosureReal:
      "World Bank Pink Sheet prices for Phosphate Rock, DAP, TSP, Urea, and Potash (Potassium Chloride) — monthly since 1960; world and country-level mine production (top 10 producing countries each, live-verified against USGS's own MCS2026 bulk data release) for the two raw minerals USGS tracks directly, Phosphate Rock and Potash; a price-cycle engine covering all five Fertilizers-category products since 1960; a Multi-Timeframe Price Heatmap; and real country-level Imports/Exports/Net Trade/Apparent Consumption/Classification for Phosphate Rock and Potash via UN Comtrade, filling in USGS's production-only gap.",
    disclosureNotBuilt:
      "World/country production for DAP, TSP, and Urea specifically — these are manufactured products (processed from Phosphate Rock, Potash, and natural gas/ammonia respectively), not raw mined minerals, so USGS's MCS doesn't track them as separate commodities; a genuine free source does exist for these (FAOSTAT's bulk fertilizer-products file, confirmed live: Urea, DAP, MAP, and Superphosphates by country, 2002-2024), but it hasn't been wired into this app yet — a real candidate for a fast follow-up, not fabricated in the meantime. Short-Term (0-30D) momentum — no daily futures feed has been verified for any of these five. Ending Stocks / Stocks-to-Use for Phosphate Rock/Potash — no free country-level source was found. Production & Export Seasonality — MCS only publishes two years per commodity.",
  });
}

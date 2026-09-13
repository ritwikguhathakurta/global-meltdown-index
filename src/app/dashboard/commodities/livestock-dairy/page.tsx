import { CommodityCategoryPage } from "../_components";

export default async function LivestockDairyPage() {
  return CommodityCategoryPage({
    category: "Livestock / Dairy",
    slug: "livestock-dairy",
    title: "Livestock / Dairy",
    intro:
      "Beef, Chicken, and Lamb — price momentum, world supply-demand balances, country-level balance sheets for Beef/Chicken/Pork, a multi-timeframe momentum heatmap, and a long-run price cycle engine. See the disclosure at the bottom for what's real here and what genuinely isn't built.",
    countryBalanceCategory: "Livestock / Dairy",
    seasonalityNote:
      "Not built. USDA PSD only publishes annual balances for Beef/Chicken/Pork — a genuine seasonality index needs monthly data, and no free monthly country-level source has been verified live yet.",
    disclosureReal:
      "World Bank Pink Sheet prices for Beef, Chicken, and Lamb — monthly since 1960; USDA FAS PSD world-level annual production/consumption/ending-stocks for Beef, Chicken, and Pork (Pork has no Pink Sheet price series, so it appears only in the balance/country-balance sections, not the price heatmap or cycle engine — shown as unavailable there, not approximated); country-level balance sheets — production, imports, exports, ending stocks (USDA PSD does report Ending Stocks for livestock, confirmed live, despite it not being a storable-crop concept in the oilseed-crush sense), apparent consumption, stocks/use, exporter/importer classification, and export HHI — for the top producers of Beef, Chicken, and Pork, computed from the USDA PSD bulk file with live-verified country codes; a price-cycle engine covering Beef and Chicken (Lamb has price data but no PSD balance code tracked, and Pork has PSD data but no price series — the cycle engine needs both a category tag and price history, so only the two with both are shown); and a Multi-Timeframe Price Heatmap.",
    disclosureNotBuilt:
      "Short-Term (0-30D) momentum — every product here only has monthly price data; no free daily futures feed (CME Live Cattle/Feeder Cattle/Lean Hogs) has been verified and wired in yet, so every Short-Term cell reads N/A. Production & Export Seasonality — see the note above. A price series or cycle-engine read for Pork specifically — the World Bank Pink Sheet doesn't price Pork at all (checked live), so only its USDA PSD balance/country-balance figures are shown above, not a momentum or cycle read.",
  });
}

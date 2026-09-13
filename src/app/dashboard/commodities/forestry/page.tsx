import { CommodityCategoryPage } from "../_components";

export default async function ForestryPage() {
  return CommodityCategoryPage({
    category: "Forestry / Other Raw Materials",
    slug: "forestry",
    title: "Forestry / Other Raw Materials",
    intro:
      "Logs (Cameroon), Logs (Malaysian), and Tobacco (US Import) — price momentum, a multi-timeframe momentum heatmap, and a long-run price cycle engine, from real World Bank Pink Sheet history.",
    countryBalanceNote:
      "Not built. No free, live, country-level production or trade source has been verified for tropical logs or tobacco imports specifically (FAOSTAT does carry a broader 'Industrial Roundwood' series, but not the two specific Cameroon/Malaysian benchmark grades priced here).",
    seasonalityNote:
      "Not built. No monthly country-level production or export data has been sourced for this category yet.",
    disclosureReal:
      "World Bank Pink Sheet prices for Logs (Cameroon), Logs (Malaysian), and Tobacco (US Import) — monthly since 1960; a price-cycle engine covering all three using the standard disclosed -20%/+20% drawdown/recovery convention with Wilson-confidence-interval transition probabilities; and a Multi-Timeframe Price Heatmap. Tobacco does have a world production figure elsewhere on this app (FAOSTAT, shown on the Soft Commodities page, since balanceTaxonomy.ts categorizes it there rather than under Forestry) — it isn't duplicated here to avoid a confusing double appearance of the same figure under two different category labels.",
    disclosureNotBuilt:
      "Short-Term (0-30D) momentum — all three products here only have monthly Pink Sheet data; no free daily futures feed has been verified for tropical logs or tobacco. World production/consumption and a Country Balance Sheet — no free, live, country-level production or trade source has been checked for tropical logs specifically (FAOSTAT does carry a broader 'Industrial Roundwood' series, but not the two specific Cameroon/Malaysian benchmark grades priced here). Production & Export Seasonality — depends on the same missing data.",
  });
}

import { CommodityCategoryPage } from "../_components";
import { massiveFuturesMetricKey } from "@/lib/sources/massiveFutures";

const DAILY_SERIES_BY_SLUG: Record<string, string> = {
  maize: massiveFuturesMetricKey("maize"),
  wheat_us_srw: massiveFuturesMetricKey("wheat_us_srw"),
};

export default async function GrainsPage() {
  return CommodityCategoryPage({
    category: "Grains",
    slug: "grains",
    title: "Grains",
    intro:
      "Barley, Corn (Maize), Sorghum, Rice, and Wheat (US SRW/HRW benchmarks), modeled the same way as the Oilseeds complex: price momentum, world supply-demand balances, country-level balance sheets for the three biggest markets, a multi-timeframe momentum heatmap with real daily futures prices for Corn and Wheat (US SRW), and a long-run price cycle engine. See the disclosure at the bottom for what's real here and what genuinely isn't built.",
    dailySeriesMetricKeyBySlug: DAILY_SERIES_BY_SLUG,
    countryBalanceCategory: "Grains",
    seasonalityNote:
      "Not built. USDA PSD (the source behind every other section on this page) only publishes annual balances — a genuine seasonality index needs monthly production or export data, and no free monthly country-level source for Wheat/Corn/Rice has been verified live yet (a candidate exists in USDA FAS's weekly Export Sales report, not yet wired in). Nothing here is approximated from the annual data to fake a monthly curve.",
    disclosureReal:
      "World Bank Pink Sheet prices for Barley, Corn (Maize), Sorghum, Rice (Thai 5%), Wheat (US SRW), and Wheat (US HRW) — monthly since 1960; USDA FAS PSD world-level annual production/consumption/ending-stocks for Wheat, Corn, Rice, Barley, Sorghum, and Oats; country-level balance sheets — production, imports, exports, ending stocks, apparent consumption (via the balance-sheet identity), stocks/use, exporter/importer classification, and export HHI — for the top 10 producing countries each of Wheat, Corn, and Rice, computed from that same USDA PSD bulk file using the identical methodology as the Oilseeds engine's Soybean Country Balance Sheet (country codes and top-producer rankings verified live against the PSD file itself, not assumed); a price-cycle engine covering all six Grains-category products since 1960, using the standard disclosed -20%/+20% drawdown/recovery convention with Wilson-confidence-interval transition probabilities; a Multi-Timeframe Price Heatmap splitting momentum into independently z-scored Short/Medium/Long buckets; and, closing the gap this section used to name, real daily CBOT futures settlement prices for Corn and Wheat (US SRW) via Massive (a paid market-data API, delayed rather than real-time on this account's plan — see massiveFutures.ts), feeding genuine Short-Term (0-30D) heatmap cells for those two.",
    disclosureNotBuilt:
      "Short-Term (0-30D) momentum for Sorghum and Rice — Massive was checked and doesn't carry CME/CBOT futures for either (Rice is thinly-traded even on CBOT itself; Sorghum has no exchange-listed contract at all), so those two still only have monthly Pink Sheet prices and read N/A rather than approximating from a single monthly print. Wheat (US HRW) specifically — CBOT's own wheat contract (ZW) is the SRW variety; KE (KC HRW Wheat) is a separate product this pass didn't add, so only the SRW row got a daily price, not HRW. Production & Export Seasonality — see the note above. Country-level balance sheets for Barley, Sorghum, and Oats — USDA PSD does carry these at the world level (shown in Complex Overview above), but per-country breakdowns weren't built this pass, since a credible top-producer list for each would need the same live verification step already done for Wheat/Corn/Rice, not assumed from memory.",
  });
}

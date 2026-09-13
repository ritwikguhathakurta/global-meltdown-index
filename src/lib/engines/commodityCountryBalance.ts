import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, previousOf, pctChangeOverDays } from "../metrics/stats";
import { COUNTRY_BALANCE_COMMODITIES, type CountryBalanceCommodityDef } from "../commodities/countryBalanceTaxonomy";

/**
 * Generic country-level balance sheet — same methodology as the Oilseeds
 * engine's Soybean Country Balance Sheet (oilseedsCountry.ts), generalized
 * to any commodity in countryBalanceTaxonomy.ts (Wheat, Corn, Rice, Cotton,
 * Sugar, Coffee, Beef, Chicken, Pork). Apparent consumption / stocks-to-use
 * / classification / export HHI are all computed here from the same
 * already-ingested USDA PSD data via the balance-sheet identity, not a new
 * source — see oilseedsCountry.ts's own doc comment for the identity and
 * classification thresholds, reused verbatim here.
 */

export type GenericCountryClass = "Major Exporter" | "Net Exporter" | "Balanced" | "Net Importer" | "Major Importer" | null;

export type CommodityCountryRow = {
  slug: string;
  label: string;
  marketYear: number | null;
  production: number | null;
  productionYoy: number | null;
  imports: number | null;
  exports: number | null;
  endingStocks: number | null;
  netTrade: number | null;
  apparentConsumption: number | null;
  stocksToUsePct: number | null;
  classification: GenericCountryClass;
  exportShareOfTracked: number | null;
};

export type CommodityCountryBalanceResult = {
  commoditySlug: string;
  commodityLabel: string;
  unit: string;
  rows: CommodityCountryRow[];
  exportHHI: number | null;
  topExporters: { label: string; shareOfTracked: number | null }[];
};

function classify(netTrade: number | null, production: number | null): GenericCountryClass {
  if (netTrade === null || production === null || production === 0) return null;
  const ratio = netTrade / production;
  if (ratio > 0.5) return "Major Exporter";
  if (ratio > 0.05) return "Net Exporter";
  if (ratio >= -0.05) return "Balanced";
  if (ratio >= -0.5) return "Net Importer";
  return "Major Importer";
}

async function buildResult(db: SupabaseClient, commodity: CountryBalanceCommodityDef): Promise<CommodityCountryBalanceResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const rows: CommodityCountryRow[] = [];
  for (const country of commodity.countries) {
    const [production, imports, exports, endingStocks] = await Promise.all([
      fetchSeries(db, `commodity.${commodity.slug}.country.${country.slug}.production`, sinceIso),
      fetchSeries(db, `commodity.${commodity.slug}.country.${country.slug}.imports`, sinceIso),
      fetchSeries(db, `commodity.${commodity.slug}.country.${country.slug}.exports`, sinceIso),
      fetchSeries(db, `commodity.${commodity.slug}.country.${country.slug}.ending_stocks`, sinceIso),
    ]);

    const lastProduction = latest(production);
    const lastImports = latest(imports);
    const lastExports = latest(exports);
    const lastStocks = latest(endingStocks);
    if (!lastProduction && !lastImports && !lastExports) continue;

    const marketYear = lastProduction?.t ?? lastExports?.t ?? lastImports?.t ?? null;
    const netTrade = lastExports && lastImports ? lastExports.v - lastImports.v : null;

    const priorStocks = previousOf(endingStocks);
    const stockChange = lastStocks && priorStocks ? lastStocks.v - priorStocks.v : null;
    const apparentConsumption =
      lastProduction && lastImports && lastExports && stockChange !== null
        ? lastProduction.v + lastImports.v - lastExports.v - stockChange
        : null;
    const stocksToUsePct = lastStocks && apparentConsumption && apparentConsumption > 0 ? (lastStocks.v / apparentConsumption) * 100 : null;

    rows.push({
      slug: country.slug,
      label: country.label,
      marketYear: marketYear ? new Date(marketYear).getUTCFullYear() : null,
      production: lastProduction?.v ?? null,
      productionYoy: pctChangeOverDays(production, 365),
      imports: lastImports?.v ?? null,
      exports: lastExports?.v ?? null,
      endingStocks: lastStocks?.v ?? null,
      netTrade,
      apparentConsumption,
      stocksToUsePct,
      classification: classify(netTrade, lastProduction?.v ?? null),
      exportShareOfTracked: null,
    });
  }

  const totalExports = rows.reduce((sum, r) => sum + (r.exports ?? 0), 0);
  if (totalExports > 0) {
    for (const r of rows) r.exportShareOfTracked = r.exports !== null ? (r.exports / totalExports) * 100 : null;
  }
  rows.sort((a, b) => (b.production ?? -Infinity) - (a.production ?? -Infinity));

  const exporters = rows.filter((r) => r.exports !== null && r.exports > 0);
  const exportTotal = exporters.reduce((sum, r) => sum + (r.exports ?? 0), 0);
  const exportHHI = exportTotal > 0 ? exporters.reduce((sum, r) => sum + ((r.exports ?? 0) / exportTotal) ** 2, 0) * 10000 : null;
  const topExporters = exporters
    .map((r) => ({ label: r.label, shareOfTracked: exportTotal > 0 ? ((r.exports ?? 0) / exportTotal) * 100 : null }))
    .sort((a, b) => (b.shareOfTracked ?? 0) - (a.shareOfTracked ?? 0))
    .slice(0, 5);

  return { commoditySlug: commodity.slug, commodityLabel: commodity.label, unit: commodity.unit, rows, exportHHI, topExporters };
}

export async function getCommodityCountryBalance(db: SupabaseClient, commoditySlug: string): Promise<CommodityCountryBalanceResult | null> {
  const commodity = COUNTRY_BALANCE_COMMODITIES.find((c) => c.slug === commoditySlug);
  if (!commodity) return null;
  return buildResult(db, commodity);
}

export async function getCommodityCountryBalancesForCategory(
  db: SupabaseClient,
  category: CountryBalanceCommodityDef["category"]
): Promise<CommodityCountryBalanceResult[]> {
  const commodities = COUNTRY_BALANCE_COMMODITIES.filter((c) => c.category === category);
  return Promise.all(commodities.map((c) => buildResult(db, c)));
}

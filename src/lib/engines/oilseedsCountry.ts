import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, previousOf, pctChangeOverDays } from "../metrics/stats";
import { SOYBEAN_COUNTRIES } from "../commodities/oilseedsTaxonomy";

/**
 * Country-level Soybean balance sheet — Oilseeds engine, spec §7, §11-15.
 * Real USDA PSD country-level data (usdaPsd.ts's
 * fetchUsdaPsdSoybeanCountryBalances), annual.
 *
 * apparentConsumption/stocksToUsePct/classification/exportHHI/China Import
 * Demand Index (spec §9, §15, §50, §105, §106, §141) are computed here
 * directly from that same already-ingested data — no new external source —
 * using the balance-sheet identity from spec §5 rearranged to solve for
 * consumption: Consumption = Beginning Stocks + Production + Imports -
 * Exports - Ending Stocks, where Beginning Stocks is read as the prior
 * year's Ending Stocks (both are the same USDA PSD series, so this isn't a
 * second independent figure). Classification thresholds (Major/Net
 * Exporter/Importer, Balanced) are disclosed round numbers on net-trade as
 * a share of production, not a hidden or fitted weighting scheme.
 */

export type CountryClass = "Major Exporter" | "Net Exporter" | "Balanced" | "Net Importer" | "Major Importer" | null;

export type SoybeanCountryRow = {
  slug: string;
  label: string;
  marketYear: number | null;
  production: number | null;
  productionYoy: number | null;
  crush: number | null;
  imports: number | null;
  exports: number | null;
  endingStocks: number | null;
  netTrade: number | null; // exports - imports; positive = net exporter
  apparentConsumption: number | null;
  stocksToUsePct: number | null;
  classification: CountryClass;
  exportShareOfTracked: number | null; // this country's share of total exports across the tracked countries
};

function classify(netTrade: number | null, production: number | null): CountryClass {
  if (netTrade === null || production === null || production === 0) return null;
  const ratio = netTrade / production;
  if (ratio > 0.5) return "Major Exporter";
  if (ratio > 0.05) return "Net Exporter";
  if (ratio >= -0.05) return "Balanced";
  if (ratio >= -0.5) return "Net Importer";
  return "Major Importer";
}

export async function getSoybeanCountryBalances(db: SupabaseClient): Promise<SoybeanCountryRow[]> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const rows: SoybeanCountryRow[] = [];
  for (const country of SOYBEAN_COUNTRIES) {
    const [production, crush, imports, exports, endingStocks] = await Promise.all([
      fetchSeries(db, `commodity.soybeans.country.${country.slug}.production`, sinceIso),
      fetchSeries(db, `commodity.soybeans.country.${country.slug}.crush`, sinceIso),
      fetchSeries(db, `commodity.soybeans.country.${country.slug}.imports`, sinceIso),
      fetchSeries(db, `commodity.soybeans.country.${country.slug}.exports`, sinceIso),
      fetchSeries(db, `commodity.soybeans.country.${country.slug}.ending_stocks`, sinceIso),
    ]);

    const lastProduction = latest(production);
    const lastCrush = latest(crush);
    const lastImports = latest(imports);
    const lastExports = latest(exports);
    const lastStocks = latest(endingStocks);
    if (!lastProduction && !lastCrush && !lastImports && !lastExports) continue;

    const marketYear = lastProduction?.t ?? lastCrush?.t ?? lastExports?.t ?? null;
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
      crush: lastCrush?.v ?? null,
      imports: lastImports?.v ?? null,
      exports: lastExports?.v ?? null,
      endingStocks: lastStocks?.v ?? null,
      netTrade,
      apparentConsumption,
      stocksToUsePct,
      classification: classify(netTrade, lastProduction?.v ?? null),
      exportShareOfTracked: null, // filled in below once every row's exports are known
    });
  }

  const totalExports = rows.reduce((sum, r) => sum + (r.exports ?? 0), 0);
  if (totalExports > 0) {
    for (const r of rows) r.exportShareOfTracked = r.exports !== null ? (r.exports / totalExports) * 100 : null;
  }

  return rows.sort((a, b) => (b.production ?? -Infinity) - (a.production ?? -Infinity));
}

export type SoybeanTradeConcentration = {
  exportHHI: number | null; // Herfindahl-Hirschman Index, 0-10000, across the tracked exporting countries
  topExporters: { label: string; shareOfTracked: number | null }[];
};

/** Spec §50 — export concentration, computed from the same country rows above (no new source). */
export function getSoybeanTradeConcentration(rows: SoybeanCountryRow[]): SoybeanTradeConcentration {
  const exporters = rows.filter((r) => r.exports !== null && r.exports > 0);
  const total = exporters.reduce((sum, r) => sum + (r.exports ?? 0), 0);
  if (total === 0) return { exportHHI: null, topExporters: [] };

  const shares = exporters.map((r) => ({ label: r.label, share: (r.exports ?? 0) / total }));
  const exportHHI = shares.reduce((sum, s) => sum + s.share * s.share, 0) * 10000;
  const topExporters = shares
    .sort((a, b) => b.share - a.share)
    .slice(0, 5)
    .map((s) => ({ label: s.label, shareOfTracked: s.share * 100 }));

  return { exportHHI, topExporters };
}

export type ChinaImportDemand = {
  importsYoy: number | null;
  crushYoy: number | null;
  indexValue: number | null; // equal-weighted average of the two YoY growth rates above, not a validated/backtested index
};

/** Spec §15 — "CHINA SOYBEAN IMPORT DEMAND INDEX", built from China's own already-ingested imports/crush series. */
export async function getChinaSoybeanImportDemand(db: SupabaseClient): Promise<ChinaImportDemand> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 5);
  const sinceIso = since.toISOString();

  const [imports, crush] = await Promise.all([
    fetchSeries(db, "commodity.soybeans.country.china.imports", sinceIso),
    fetchSeries(db, "commodity.soybeans.country.china.crush", sinceIso),
  ]);

  const importsYoy = pctChangeOverDays(imports, 365);
  const crushYoy = pctChangeOverDays(crush, 365);
  const values = [importsYoy, crushYoy].filter((v): v is number => v !== null);
  const indexValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return { importsYoy, crushYoy, indexValue };
}

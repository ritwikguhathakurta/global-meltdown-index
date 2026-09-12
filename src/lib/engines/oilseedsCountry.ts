import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays } from "../metrics/stats";
import { SOYBEAN_COUNTRIES } from "../commodities/oilseedsTaxonomy";

/**
 * Country-level Soybean balance sheet — Oilseeds engine, spec §7, §11-15.
 * Real USDA PSD country-level data (usdaPsd.ts's
 * fetchUsdaPsdSoybeanCountryBalances), annual.
 */

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
};

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
    });
  }

  return rows.sort((a, b) => (b.production ?? -Infinity) - (a.production ?? -Infinity));
}

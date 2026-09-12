import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays } from "../metrics/stats";
import type { Point } from "../metrics/stats";

const MALAYSIA_EXPORT_PRODUCTS: { slug: string; label: string }[] = [
  { slug: "cpo", label: "CPO" },
  { slug: "ppo", label: "PPO" },
  { slug: "palm_oil", label: "Palm Oil (total)" },
  { slug: "cpko", label: "CPKO" },
  { slug: "ppko", label: "PPKO" },
  { slug: "palm_kernel_oil", label: "Palm Kernel Oil (total)" },
  { slug: "palm_kernel_cake", label: "Palm Kernel Cake" },
  { slug: "oleochemicals", label: "Oleochemicals" },
  { slug: "finished_products", label: "Finished Products" },
  { slug: "biodiesel", label: "Biodiesel" },
  { slug: "others", label: "Others" },
  { slug: "total", label: "TOTAL" },
];

export type IndonesiaPalmRow = {
  label: string;
  latestAnnual: number | null;
  latestAnnualYear: number | null;
  annualYoy: number | null;
  latestMonthlyLargeEstate: number | null;
  latestMonthlyLargeEstateDate: string | null;
};

export type MalaysiaExportRow = {
  slug: string;
  label: string;
  latestValue: number | null;
  latestDate: string | null;
  yoy: number | null;
};

export type CmeFuturesPrice = {
  latestValue: number | null;
  latestDate: string | null;
  change12m: number | null;
};

export type SeAsiaPalmResult = {
  indonesiaOilPalm: IndonesiaPalmRow;
  indonesiaCoconut: IndonesiaPalmRow;
  malaysiaExports: MalaysiaExportRow[];
  cmeFuturesPrice: CmeFuturesPrice;
};

function buildIndonesiaRow(label: string, annual: Point[], monthly: Point[]): IndonesiaPalmRow {
  const lastAnnual = latest(annual);
  const lastMonthly = latest(monthly);
  return {
    label,
    latestAnnual: lastAnnual?.v ?? null,
    latestAnnualYear: lastAnnual ? new Date(lastAnnual.t).getUTCFullYear() : null,
    annualYoy: pctChangeOverDays(annual, 365),
    latestMonthlyLargeEstate: lastMonthly?.v ?? null,
    latestMonthlyLargeEstateDate: lastMonthly?.t ?? null,
  };
}

export async function getSeAsiaPalmBalances(db: SupabaseClient): Promise<SeAsiaPalmResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 12);
  const sinceIso = since.toISOString();

  const [oilPalmAnnual, oilPalmMonthly, coconutAnnual, cmeFutures] = await Promise.all([
    fetchSeries(db, "commodity.palm_oil.indonesia.production", sinceIso),
    fetchSeries(db, "commodity.palm_oil.indonesia.production_monthly_large_estate", sinceIso),
    fetchSeries(db, "commodity.coconut.indonesia.production", sinceIso),
    fetchSeries(db, "commodity.palm_oil.cme_futures_price", sinceIso),
  ]);

  const lastCmeFutures = latest(cmeFutures);
  const cmeFuturesPrice: CmeFuturesPrice = {
    latestValue: lastCmeFutures?.v ?? null,
    latestDate: lastCmeFutures?.t ?? null,
    change12m: pctChangeOverDays(cmeFutures, 365),
  };

  const indonesiaOilPalm = buildIndonesiaRow("Oil Palm (CPO, all ownership)", oilPalmAnnual, oilPalmMonthly);
  const indonesiaCoconut = buildIndonesiaRow("Coconut (all ownership)", coconutAnnual, []);

  const malaysiaExportsRaw = await Promise.all(
    MALAYSIA_EXPORT_PRODUCTS.map(async (p) => {
      const series = await fetchSeries(db, `commodity.palm_oil.malaysia.export.${p.slug}`, sinceIso);
      const last = latest(series);
      return {
        slug: p.slug,
        label: p.label,
        latestValue: last?.v ?? null,
        latestDate: last?.t ?? null,
        yoy: pctChangeOverDays(series, 365),
      };
    })
  );

  return {
    indonesiaOilPalm,
    indonesiaCoconut,
    malaysiaExports: malaysiaExportsRaw.filter((r) => r.latestValue !== null),
    cmeFuturesPrice,
  };
}

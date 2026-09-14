import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays } from "../metrics/stats";
import { OLEOCHEMICAL_TRADE_COMMODITIES } from "../sources/unComtrade";

/**
 * Oleochemicals — the special-depth module the Chemicals engine spec asks
 * for (§2, §10-21), scoped to what's genuinely free and live:
 *
 *  - Palm Oil / Palm Kernel Oil price context, reusing the existing
 *    Oilseeds engine's own already-ingested World Bank Pink Sheet data (no
 *    new source — this is the "mandatory connection" the spec's §2/§7
 *    insists on).
 *  - Fatty Acids / Surfactants US Producer Price Index (see
 *    chemicalsTaxonomy.ts/fred.ts) — the only genuine free downstream
 *    chemical price proxy this app could find; explicitly NOT a global
 *    fatty-acid spot price, disclosed as such.
 *  - Oleochemical trade flows (Malaysia/Indonesia exports of Palm Oil, Palm
 *    Kernel/Coconut Oil, industrial Fatty Acids/Fatty Alcohols/PFAD, and
 *    Surfactants) via UN Comtrade, extended from the Energy Trade Network's
 *    existing connector to a country/HS universe that actually covers the
 *    two dominant oleochemical exporters (see unComtrade.ts).
 *
 * A genuine "oleochemical conversion margin" (spec §36) is NOT computed
 * here: that needs a fatty-acid price in the SAME per-unit terms as the
 * Palm Oil feedstock price (e.g. $/MT), and the only free fatty-acid series
 * found is a US producer price INDEX, not a $/MT price — dividing an index
 * by a $/MT price would produce a number that looks like a margin but isn't
 * one. Shown side by side as two independent trends instead, not merged
 * into a fabricated spread.
 */

export type OleochemicalPriceContext = {
  slug: string;
  label: string;
  latestValue: number | null;
  unit: string;
  asOf: string | null;
  change12m: number | null;
};

export type OleochemicalTradeFlow = {
  hsCode: string;
  commoditySlug: string;
  commodityLabel: string;
  reporter: string;
  partner: string;
  valueUsd: number;
  year: number;
};

export type OleochemicalsResult = {
  priceContext: OleochemicalPriceContext[];
  tradeFlows: OleochemicalTradeFlow[];
  tradeFlowsAsOfYear: number | null;
};

const PRICE_CONTEXT_SERIES: { slug: string; label: string; metricKey: string; unit: string }[] = [
  { slug: "palm_oil", label: "Palm Oil (feedstock, World Bank Pink Sheet)", metricKey: "commodity.palm_oil.price", unit: "USD/mt" },
  { slug: "palm_kernel_oil", label: "Palm Kernel Oil (feedstock, World Bank Pink Sheet)", metricKey: "commodity.palm_kernel_oil.price", unit: "USD/mt" },
  { slug: "fatty_acids", label: "Fatty Acids (US PPI proxy — index, not a spot price)", metricKey: "chemical.fatty_acids.ppi", unit: "index 1982=100" },
  { slug: "surfactants", label: "Surfactants (US PPI proxy — index, not a spot price)", metricKey: "chemical.surfactants.ppi", unit: "index 1982=100" },
];

async function fetchTradeFlowsForCommodity(
  db: SupabaseClient,
  commoditySlug: string,
  commodityLabel: string,
  hsCode: string
): Promise<{ flows: OleochemicalTradeFlow[]; year: number | null }> {
  const { data, error } = await db
    .from("metric_series")
    .select("metric_key, observed_at, value")
    .like("metric_key", `chemical.oleochemical_trade.${commoditySlug}.%`)
    .order("observed_at", { ascending: false });
  if (error) throw new Error(`fetchTradeFlowsForCommodity(${commoditySlug}): ${error.message}`);
  if (!data || data.length === 0) return { flows: [], year: null };

  const latestObservedAt = data[0].observed_at as string;
  const year = new Date(latestObservedAt).getUTCFullYear();
  const flows: OleochemicalTradeFlow[] = [];
  const countryLabel = (slug: string) =>
    slug
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");

  for (const row of data) {
    if (row.observed_at !== latestObservedAt) continue;
    const key = row.metric_key as string;
    const prefix = `chemical.oleochemical_trade.${commoditySlug}.`;
    const pairPart = key.slice(prefix.length);
    // Split on the literal "_to_" separator, not every underscore — country
    // slugs themselves contain underscores (e.g. "united_states",
    // "south_korea"), so a naive split("_") would misparse the pair.
    const sepIndex = pairPart.indexOf("_to_");
    if (sepIndex === -1) continue;
    const reporterSlug = pairPart.slice(0, sepIndex);
    const partnerSlug = pairPart.slice(sepIndex + "_to_".length);
    if (!reporterSlug || !partnerSlug) continue;
    flows.push({
      hsCode,
      commoditySlug,
      commodityLabel,
      reporter: countryLabel(reporterSlug),
      partner: countryLabel(partnerSlug),
      valueUsd: row.value as number,
      year,
    });
  }
  return { flows, year };
}

export async function getOleochemicals(db: SupabaseClient): Promise<OleochemicalsResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const [priceSeriesList, tradeResults] = await Promise.all([
    Promise.all(PRICE_CONTEXT_SERIES.map((p) => fetchSeries(db, p.metricKey, sinceIso))),
    Promise.all(OLEOCHEMICAL_TRADE_COMMODITIES.map((c) => fetchTradeFlowsForCommodity(db, c.slug, c.label, c.hsCode))),
  ]);

  const priceContext: OleochemicalPriceContext[] = PRICE_CONTEXT_SERIES.map((p, i) => {
    const series = priceSeriesList[i];
    const last = latest(series);
    return {
      slug: p.slug,
      label: p.label,
      latestValue: last?.v ?? null,
      unit: p.unit,
      asOf: last?.t ?? null,
      change12m: pctChangeOverDays(series, 365),
    };
  });

  const tradeFlows = tradeResults.flatMap((r) => r.flows).sort((a, b) => b.valueUsd - a.valueUsd);
  const tradeFlowsAsOfYear = tradeResults.map((r) => r.year).filter((y): y is number => y !== null)[0] ?? null;

  return { priceContext, tradeFlows, tradeFlowsAsOfYear };
}

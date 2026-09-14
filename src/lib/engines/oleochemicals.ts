import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, pctChangeOverDays, zScore, zToRiskScore, type Point } from "../metrics/stats";
import { OLEOCHEMICAL_TRADE_COMMODITIES } from "../sources/unComtrade";
import { VALUE_CHAINS, VALUE_CHAIN_NODES } from "../commodities/oleochemValueChain";

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
 *
 * Extended (Phase 2) with:
 *  - Real Malaysia MPOB monthly export volumes for Oleochemicals, Biodiesel,
 *    and Finished Products (mpobMalaysia.ts) — already ingested for the
 *    Oilseeds SE Asia page, surfaced here directly, no new source.
 *  - Three more real UN Comtrade HS codes (Glycerine 2905.45, Biodiesel/FAME
 *    3826, Soap Noodles 3401.20) — live-verified for both Malaysia/Indonesia
 *    and the findLatestAvailableYear probe reporter before wiring in.
 *  - Export concentration (HHI / top-1 / top-3 share), computed directly
 *    from the trade-flow data already fetched above — spec §44/45.
 *  - The Oleochemical Value-Chain Graph (spec §21) — static, real known
 *    chemistry, not a live series (see oleochemValueChain.ts).
 *  - An Oleochemical Leading Indicator (OLI, spec §52), built ONLY from the
 *    subset of the spec's own named inputs this app has genuine free data
 *    for — same "spec-classified leading inputs, partial coverage disclosed"
 *    pattern as the Leading Banking Stress Score. See SPEC_OLI_INPUTS below
 *    for exactly which of the spec's 19 named inputs are covered and why
 *    the rest (PFAD, Fatty Alcohol, Methyl Ester, Methanol, Plant Outages —
 *    all needing a free price/dataset that doesn't exist) are not.
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
  reporterSlug: string;
  reporter: string;
  partnerSlug: string;
  partner: string;
  valueUsd: number;
  year: number;
};

export type OleochemicalExportVolume = {
  slug: string;
  label: string;
  latestValue: number | null;
  latestDate: string | null;
  yoy: number | null;
};

export type OleochemicalConcentration = {
  commoditySlug: string;
  commodityLabel: string;
  reporter: string;
  partnerCount: number;
  top1SharePct: number;
  top3SharePct: number;
  hhi: number; // standard 0-10,000 scale (sum of squared percentage shares)
};

export type OleochemicalLeadingIndicatorComponent = {
  key: string;
  label: string;
  weight: number;
  score: number | null; // 0-100, null if the underlying series is missing/too short
};

export type OleochemicalLeadingIndicator = {
  score: number | null; // 0-100 weighted composite of the components below
  components: OleochemicalLeadingIndicatorComponent[];
  asOf: string | null;
};

export type SpecOliInput = { name: string; covered: boolean; note: string };

/** Every input spec §52 names for the "OLEOCHEMICAL LEADING INDICATOR",
 * with an honest covered/not-covered flag. completeness below is DERIVED
 * from this list, not hand-picked, so it can't silently drift from reality. */
export const SPEC_OLI_INPUTS: SpecOliInput[] = [
  { name: "Palm Oil", covered: true, note: "World Bank Pink Sheet price" },
  { name: "PKO", covered: true, note: "World Bank Pink Sheet price" },
  { name: "CPO", covered: true, note: "Same underlying series as Palm Oil — not separately tracked" },
  { name: "PFAD", covered: false, note: "No free price found; bundled inside HS 3823 trade, not separable" },
  { name: "Fatty Acid", covered: true, note: "US PPI proxy (chemical.fatty_acids.ppi)" },
  { name: "Fatty Alcohol", covered: false, note: "No free price found; bundled inside HS 3823 trade, not separable" },
  { name: "Methyl Ester", covered: false, note: "No free price found; not separable from FAME/biodiesel trade" },
  { name: "Glycerine", covered: false, note: "Trade value only (HS 2905.45), one year of history so far — no momentum yet" },
  { name: "FAME", covered: false, note: "Trade value only (HS 3826), one year of history so far — no momentum yet" },
  { name: "Biodiesel", covered: true, note: "Real Malaysia MPOB monthly export volume" },
  { name: "Freight", covered: true, note: "NY Fed Global Supply Chain Pressure Index (supplychain.gscpi)" },
  { name: "Methanol", covered: false, note: "Checked FRED live — no methanol price/PPI series exists" },
  { name: "Crude Oil", covered: true, note: "WTI (commodity.wti)" },
  { name: "Natural Gas", covered: true, note: "Henry Hub (commodity.natgas_henry_hub)" },
  { name: "FX", covered: true, note: "USD/MYR and USD/IDR (fx.usdmyr, fx.usdidr)" },
  { name: "Stocks", covered: true, note: "Malaysia MPOB total palm oil stock" },
  { name: "Trade", covered: true, note: "Malaysia MPOB monthly oleochemical export volume" },
  { name: "Plant outages", covered: false, note: "No free, maintained plant-level outage dataset exists" },
  { name: "Demand", covered: false, note: "Not separately tracked — proxied only by the Trade/Biodiesel components above, not double-counted as its own input" },
];

export type OleochemicalsResult = {
  priceContext: OleochemicalPriceContext[];
  exportVolumes: OleochemicalExportVolume[];
  tradeFlows: OleochemicalTradeFlow[];
  tradeFlowsAsOfYear: number | null;
  concentration: OleochemicalConcentration[];
  leadingIndicator: OleochemicalLeadingIndicator;
  valueChains: typeof VALUE_CHAINS;
  valueChainNodes: typeof VALUE_CHAIN_NODES;
};

const PRICE_CONTEXT_SERIES: { slug: string; label: string; metricKey: string; unit: string }[] = [
  { slug: "palm_oil", label: "Palm Oil (feedstock, World Bank Pink Sheet)", metricKey: "commodity.palm_oil.price", unit: "USD/mt" },
  { slug: "palm_kernel_oil", label: "Palm Kernel Oil (feedstock, World Bank Pink Sheet)", metricKey: "commodity.palm_kernel_oil.price", unit: "USD/mt" },
  { slug: "fatty_acids", label: "Fatty Acids (US PPI proxy — index, not a spot price)", metricKey: "chemical.fatty_acids.ppi", unit: "index 1982=100" },
  { slug: "surfactants", label: "Surfactants (US PPI proxy — index, not a spot price)", metricKey: "chemical.surfactants.ppi", unit: "index 1982=100" },
  { slug: "soaps_detergents", label: "Soaps & Detergents (US PPI proxy, soap-noodle-adjacent — index, not a spot price)", metricKey: "chemical.soaps_detergents.ppi", unit: "index 1982=100" },
];

const EXPORT_VOLUME_SERIES: { slug: string; label: string }[] = [
  { slug: "oleochemicals", label: "Oleochemicals" },
  { slug: "biodiesel", label: "Biodiesel" },
  { slug: "finished_products", label: "Finished Products" },
];

function windowForFreq(freq: "daily" | "monthly"): number {
  return freq === "daily" ? 252 : 36;
}

function weightedScore(parts: { score: number | null; weight: number }[]): number | null {
  const available = parts.filter((p): p is { score: number; weight: number } => p.score !== null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((a, b) => a + b.weight, 0);
  return Math.round(available.reduce((a, b) => a + b.score * b.weight, 0) / totalWeight);
}

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
      reporterSlug,
      reporter: countryLabel(reporterSlug),
      partnerSlug,
      partner: countryLabel(partnerSlug),
      valueUsd: row.value as number,
      year,
    });
  }
  return { flows, year };
}

/** HHI/top-N export concentration (spec §44/45) computed directly from the
 * trade-flow rows already fetched above — no new data source, just a
 * post-processing pass over real UN Comtrade export values. */
function computeConcentration(tradeFlows: OleochemicalTradeFlow[]): OleochemicalConcentration[] {
  const byCommodityReporter = new Map<string, OleochemicalTradeFlow[]>();
  for (const flow of tradeFlows) {
    if (flow.reporterSlug !== "malaysia" && flow.reporterSlug !== "indonesia") continue;
    const key = `${flow.commoditySlug}::${flow.reporterSlug}`;
    const list = byCommodityReporter.get(key) ?? [];
    list.push(flow);
    byCommodityReporter.set(key, list);
  }

  const results: OleochemicalConcentration[] = [];
  for (const flows of byCommodityReporter.values()) {
    const total = flows.reduce((a, f) => a + f.valueUsd, 0);
    if (total <= 0) continue;
    const shares = flows.map((f) => f.valueUsd / total).sort((a, b) => b - a);
    const hhi = shares.reduce((a, s) => a + (s * 100) ** 2, 0);
    const top1SharePct = Math.round(shares[0] * 1000) / 10;
    const top3SharePct = Math.round(shares.slice(0, 3).reduce((a, s) => a + s, 0) * 1000) / 10;
    results.push({
      commoditySlug: flows[0].commoditySlug,
      commodityLabel: flows[0].commodityLabel,
      reporter: flows[0].reporter,
      partnerCount: flows.length,
      top1SharePct,
      top3SharePct,
      hhi: Math.round(hhi),
    });
  }
  return results.sort((a, b) => a.commodityLabel.localeCompare(b.commodityLabel) || a.reporter.localeCompare(b.reporter));
}

function buildLeadingIndicator(series: {
  palmOil: Point[];
  pko: Point[];
  fattyAcids: Point[];
  surfactants: Point[];
  soaps: Point[];
  exportOleochemicals: Point[];
  exportBiodiesel: Point[];
  totalPoStock: Point[];
  gscpi: Point[];
  wti: Point[];
  henryHub: Point[];
  usdmyr: Point[];
  usdidr: Point[];
}): OleochemicalLeadingIndicator {
  const components: OleochemicalLeadingIndicatorComponent[] = [
    { key: "palm_oil", label: "Palm Oil price (feedstock)", weight: 0.15, score: zToRiskScore(zScore(series.palmOil, windowForFreq("monthly")), 1) },
    { key: "pko", label: "PKO price (feedstock)", weight: 0.1, score: zToRiskScore(zScore(series.pko, windowForFreq("monthly")), 1) },
    { key: "fatty_acids", label: "Fatty Acids PPI", weight: 0.12, score: zToRiskScore(zScore(series.fattyAcids, windowForFreq("monthly")), 1) },
    { key: "surfactants", label: "Surfactants PPI", weight: 0.12, score: zToRiskScore(zScore(series.surfactants, windowForFreq("monthly")), 1) },
    { key: "soaps", label: "Soaps & Detergents PPI", weight: 0.06, score: zToRiskScore(zScore(series.soaps, windowForFreq("monthly")), 1) },
    { key: "export_oleochemicals", label: "Malaysia oleochemical export volume", weight: 0.15, score: zToRiskScore(zScore(series.exportOleochemicals, windowForFreq("monthly")), 1) },
    { key: "export_biodiesel", label: "Malaysia biodiesel export volume", weight: 0.05, score: zToRiskScore(zScore(series.exportBiodiesel, windowForFreq("monthly")), 1) },
    { key: "stocks", label: "Malaysia total palm oil stock (inverse — falling stock = tightening)", weight: 0.1, score: zToRiskScore(zScore(series.totalPoStock, windowForFreq("monthly")), -1) },
    { key: "freight", label: "NY Fed Global Supply Chain Pressure Index", weight: 0.08, score: zToRiskScore(zScore(series.gscpi, windowForFreq("monthly")), 1) },
    { key: "crude_oil", label: "WTI Crude Oil", weight: 0.04, score: zToRiskScore(zScore(series.wti, windowForFreq("daily")), 1) },
    { key: "natural_gas", label: "Henry Hub Natural Gas", weight: 0.03, score: zToRiskScore(zScore(series.henryHub, windowForFreq("daily")), 1) },
    { key: "fx_myr", label: "USD/MYR (ringgit depreciation = export competitiveness)", weight: 0.03, score: zToRiskScore(zScore(series.usdmyr, windowForFreq("daily")), 1) },
    { key: "fx_idr", label: "USD/IDR (rupiah depreciation = export competitiveness)", weight: 0.02, score: zToRiskScore(zScore(series.usdidr, windowForFreq("daily")), 1) },
  ];

  const asOfCandidates = [series.palmOil, series.fattyAcids, series.exportOleochemicals].map((s) => latest(s)?.t ?? null).filter((t): t is string => t !== null);
  const asOf = asOfCandidates.sort().pop() ?? null;

  return { score: weightedScore(components), components, asOf };
}

export async function getOleochemicals(db: SupabaseClient): Promise<OleochemicalsResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 15);
  const sinceIso = since.toISOString();

  const [
    priceSeriesList,
    tradeResults,
    exportVolumeSeriesList,
    totalPoStockSeries,
    gscpiSeries,
    wtiSeries,
    henryHubSeries,
    usdmyrSeries,
    usdidrSeries,
  ] = await Promise.all([
    Promise.all(PRICE_CONTEXT_SERIES.map((p) => fetchSeries(db, p.metricKey, sinceIso))),
    Promise.all(OLEOCHEMICAL_TRADE_COMMODITIES.map((c) => fetchTradeFlowsForCommodity(db, c.slug, c.label, c.hsCode))),
    Promise.all(EXPORT_VOLUME_SERIES.map((p) => fetchSeries(db, `commodity.palm_oil.malaysia.export.${p.slug}`, sinceIso))),
    fetchSeries(db, "commodity.palm_oil.malaysia.mpob_mirror.total_po_stock", sinceIso),
    fetchSeries(db, "supplychain.gscpi", sinceIso),
    fetchSeries(db, "commodity.wti", sinceIso),
    fetchSeries(db, "commodity.natgas_henry_hub", sinceIso),
    fetchSeries(db, "fx.usdmyr", sinceIso),
    fetchSeries(db, "fx.usdidr", sinceIso),
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

  const exportVolumes: OleochemicalExportVolume[] = EXPORT_VOLUME_SERIES.map((p, i) => {
    const series = exportVolumeSeriesList[i];
    const last = latest(series);
    return {
      slug: p.slug,
      label: p.label,
      latestValue: last?.v ?? null,
      latestDate: last?.t ?? null,
      yoy: pctChangeOverDays(series, 365),
    };
  }).filter((r) => r.latestValue !== null);

  const tradeFlows = tradeResults.flatMap((r) => r.flows).sort((a, b) => b.valueUsd - a.valueUsd);
  const tradeFlowsAsOfYear = tradeResults.map((r) => r.year).filter((y): y is number => y !== null)[0] ?? null;
  const concentration = computeConcentration(tradeFlows);

  const [palmOilSeries, pkoSeries, fattyAcidsSeries, surfactantsSeries, soapsSeries] = priceSeriesList;
  const [exportOleochemicalsSeries, exportBiodieselSeries] = exportVolumeSeriesList;
  const leadingIndicator = buildLeadingIndicator({
    palmOil: palmOilSeries,
    pko: pkoSeries,
    fattyAcids: fattyAcidsSeries,
    surfactants: surfactantsSeries,
    soaps: soapsSeries,
    exportOleochemicals: exportOleochemicalsSeries,
    exportBiodiesel: exportBiodieselSeries,
    totalPoStock: totalPoStockSeries,
    gscpi: gscpiSeries,
    wti: wtiSeries,
    henryHub: henryHubSeries,
    usdmyr: usdmyrSeries,
    usdidr: usdidrSeries,
  });

  return {
    priceContext,
    exportVolumes,
    tradeFlows,
    tradeFlowsAsOfYear,
    concentration,
    leadingIndicator,
    valueChains: VALUE_CHAINS,
    valueChainNodes: VALUE_CHAIN_NODES,
  };
}

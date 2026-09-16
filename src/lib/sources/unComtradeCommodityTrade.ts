import type { MetricPoint } from "../metrics/store";
import { COUNTRY_BALANCE_COMMODITIES, type CountryBalanceCommodityDef } from "../commodities/countryBalanceTaxonomy";

export const USGS_TRADE_COMMODITIES: CountryBalanceCommodityDef[] = COUNTRY_BALANCE_COMMODITIES.filter(
  (c) => c.source === "usgs_mcs" && c.comtradeHsCodes
);

/**
 * Real country-level imports/exports for the USGS-sourced metals/fertilizers
 * (Base Metals, Precious Metals, Critical Minerals, Fertilizers in
 * countryBalanceTaxonomy.ts) — USGS's Mineral Commodity Summaries publishes
 * mine/smelter PRODUCTION only, so Imports/Exports/Net Trade/Apparent
 * Consumption/Classification read "—" for every one of those rows in
 * commodityCountryBalance.ts without this. This connector fills exactly
 * those four fields (Ending Stocks stays "—" — no free country-level stocks
 * source was found for any of these commodities) from real UN Comtrade
 * trade statistics, on the registered-key tier (see unComtrade.ts).
 *
 * IMPORTANT BASIS CAVEAT, disclosed on the page too: each commodity's HS
 * code(s) (countryBalanceTaxonomy.ts's `comtradeHsCodes`) were chosen and
 * live-verified as the commodity's DOMINANT internationally-traded product
 * FORM — e.g. unwrought metal, ore concentrate, or refined cathode — not a
 * contained-metal-equivalent conversion. A country that processes its ore
 * into a different form before export than the HS code(s) chosen will show
 * a mismatched trade figure relative to its USGS mine-production tonnage.
 * Confirmed live during this build for Nickel specifically: summing
 * unwrought nickel (HS 7502) with ferronickel (HS 720260) made Indonesia's
 * "exports" come out to 11.6M tonnes against 2.6M tonnes of mine
 * production — physically impossible-looking, because ferronickel is an
 * iron-diluted alloy (roughly 10-40% nickel by weight depending on grade),
 * not a weight-comparable product to refined nickel metal. Nickel therefore
 * uses HS 7502 alone: this correctly shows Indonesia/Philippines exporting
 * only a small fraction of their mine production as unwrought metal (they
 * convert most of it domestically into other forms — stainless steel,
 * battery precursors, ferronickel — rather than exporting raw nickel), a
 * real and informative fact, not an undercount to "fix." The same
 * single-dominant-form choice (not a multi-code sum) is used for every
 * other commodity here for the same reason.
 *
 * A second, distinct basis note for Lithium specifically: USGS reports mine
 * production as elemental lithium content, but the dominant traded form
 * (HS 283691, lithium carbonate) is a compound that's only ~19% lithium by
 * mass — so Chile's real exports (~220K tonnes of carbonate, cross-checked
 * live against this build) correctly convert to roughly 42K tonnes of
 * contained lithium, close to its ~56K tonne production figure, even though
 * the raw carbonate-mass export number looks ~4x larger side by side with
 * the metal-content production number. Not converted here (that would mean
 * assuming a specific carbonate purity/grade this app has no per-shipment
 * basis for) — shown as real carbonate-mass trade, disclosed as such.
 *
 * Also confirmed live: some major producers report trade VALUE but not
 * WEIGHT to Comtrade for certain commodities (Mexico/silver, South
 * Africa/platinum both returned qtyUnitCode -1 "not available"), and some
 * countries barely report to Comtrade at all (DRC/cobalt: isReported=false,
 * a mirror-estimated total with no weight, even at the all-commodities
 * level) — both cases correctly yield no imports/exports for that specific
 * country row rather than a fabricated number.
 */

const BASE_URL = "https://comtradeapi.un.org/data/v1/get/C/A/HS";
const SUBSCRIPTION_KEY = process.env.UN_COMTRADE_SUBSCRIPTION_KEY;

type ComtradeRow = {
  flowCode: string;
  motCode: number;
  partner2Code: number;
  primaryValue: number | null;
  qtyUnitCode?: number;
  netWgt?: number | null;
  period: string;
};
type ComtradeResponse = { data?: ComtradeRow[] };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Thrown when the subscription key's daily call-volume quota is exhausted
 * (confirmed live during this build: Azure APIM returns HTTP 403 with body
 * `{"statusCode":403,"message":"Out of call volume quota. Quota will be
 * replenished in HH:MM:SS."}` — a DAILY quota, distinct from the per-burst
 * 429 rate limit both Comtrade tiers also enforce). Retrying does nothing
 * until the quota resets, so this is deliberately NOT retried like 429 is —
 * the caller stops the whole ingest run early instead of burning through
 * every remaining call on guaranteed failures. */
export class ComtradeQuotaExceededError extends Error {}

async function comtradeQuery(reporterCode: string, period: string, cmdCodes: string[]): Promise<ComtradeRow[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("reporterCode", reporterCode);
  url.searchParams.set("partnerCode", "0");
  url.searchParams.set("period", period);
  url.searchParams.set("cmdCode", cmdCodes.join(","));
  const headers: HeadersInit | undefined = SUBSCRIPTION_KEY ? { "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY } : undefined;

  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch(url.toString(), { next: { revalidate: 0 }, headers });
    if (res.status === 403) {
      const body = await res.text().catch(() => "");
      throw new ComtradeQuotaExceededError(`UN Comtrade quota exceeded: ${body || "HTTP 403"}`);
    }
    if (res.status === 429) {
      if (attempt === 2) throw new Error(`rate limited after retries (reporter ${reporterCode}, cmd ${cmdCodes.join(",")})`);
      await delay(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} (reporter ${reporterCode}, cmd ${cmdCodes.join(",")})`);
    const json = (await res.json()) as ComtradeResponse;
    return json.data ?? [];
  }
  return [];
}

const DELAY_MS = SUBSCRIPTION_KEY ? 350 : 1500;

function unitDivisor(unit: string): number {
  if (unit === "kilograms") return 1;
  if (unit === "metric tons") return 1000;
  if (unit === "thousand metric tons") return 1_000_000;
  throw new Error(`unComtradeCommodityTrade: unhandled unit "${unit}"`);
}

/** Sums the grand-total (motCode=0, partner2Code=0) export/import weight
 * across every returned row (regardless of which of the possibly-multiple
 * cmdCodes it belongs to) — only kilogram-denominated rows (qtyUnitCode 8)
 * are trusted, matching the same rigor as the oleochemical trend connector. */
function sumGrandTotals(rows: ComtradeRow[]): { exportKg: number | null; importKg: number | null } {
  let exportKg: number | null = null;
  let importKg: number | null = null;
  for (const row of rows) {
    if (row.motCode !== 0 || row.partner2Code !== 0) continue;
    if (row.qtyUnitCode !== 8 || !row.netWgt || row.netWgt <= 0) continue;
    if (row.flowCode === "X") exportKg = (exportKg ?? 0) + row.netWgt;
    else if (row.flowCode === "M") importKg = (importKg ?? 0) + row.netWgt;
  }
  return { exportKg, importKg };
}

/** Finds the most recent year THIS SPECIFIC country actually has usable
 * (grand-total, kg-denominated) data for — each country reports to Comtrade
 * on its own lag, so a single shared "latest year" (as the energy/
 * oleochemical connectors use, probed from one fixed reference reporter)
 * would wrongly skip countries that report faster or slower than that
 * reference.
 *
 * Fetches the last 5 candidate years in ONE call (Comtrade's `period` param
 * accepts a comma-separated list, live-verified before this was written) and
 * picks the newest year with data from the combined response, instead of up
 * to 5 sequential single-year probe calls. This was the dominant cost of the
 * whole stage: at ~18 commodities x ~9 countries each, the old one-call-per-
 * probe-year approach could burn up to ~800 calls in a single ingest run —
 * against a small shared daily quota that three separate UN Comtrade-backed
 * pipeline stages compete for concurrently, this stage was in practice
 * exhausting its share (getting a 403 "Out of call volume quota") before it
 * could even finish its first commodity, confirmed live: this stage had run
 * exactly once ever and produced zero points for any of its 18 commodities.
 * The 5x-fewer-calls version alone doesn't guarantee it always wins that
 * race, so see ingestUsgsCommodityCountryTrade's resumable cursor for the
 * other half of the fix. */
async function findLatestYearForCountry(reporterCode: string, cmdCodes: string[]): Promise<{ year: string; rows: ComtradeRow[] } | null> {
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 1 - i));
  const rows = await comtradeQuery(reporterCode, years.join(","), cmdCodes);

  const rowsByYear = new Map<string, ComtradeRow[]>();
  for (const row of rows) {
    const list = rowsByYear.get(row.period);
    if (list) list.push(row);
    else rowsByYear.set(row.period, [row]);
  }
  for (const year of years) {
    const yearRows = rowsByYear.get(year);
    if (!yearRows) continue;
    const totals = sumGrandTotals(yearRows);
    if (totals.exportKg !== null || totals.importKg !== null) return { year, rows: yearRows };
  }
  return null;
}

/** Fetches ONE commodity's country-level imports/exports. Split out so the
 * caller (ingest.ts) can upsert each commodity's points as soon as they
 * land, rather than waiting for all 18 to finish — the same incremental-
 * upsert lesson as the oleochemical UN Comtrade connector: with up to ~150
 * (country, commodity) pairs each needing 1-5 probe calls, a single slow or
 * gap-heavy commodity must never cost every other commodity's already-
 * fetched data. */
export async function fetchUsgsCommodityCountryTradeForCommodity(
  commodity: CountryBalanceCommodityDef
): Promise<{ points: MetricPoint[]; errors: string[] }> {
  const points: MetricPoint[] = [];
  const errors: string[] = [];
  const divisor = unitDivisor(commodity.unit);

  for (const country of commodity.countries) {
    if (!country.comtradeM49Code) continue;
    try {
      const found = await findLatestYearForCountry(country.comtradeM49Code, commodity.comtradeHsCodes!);
      if (found) {
        const { exportKg, importKg } = sumGrandTotals(found.rows);
        const observedAt = `${found.year}-12-31`;
        if (exportKg !== null) {
          points.push({
            metric_key: `commodity.${commodity.slug}.country.${country.slug}.exports`,
            observed_at: observedAt,
            value: exportKg / divisor,
            unit: commodity.unit,
            source_key: "un_comtrade",
            source_tier: 1,
            frequency: "annual",
          });
        }
        if (importKg !== null) {
          points.push({
            metric_key: `commodity.${commodity.slug}.country.${country.slug}.imports`,
            observed_at: observedAt,
            value: importKg / divisor,
            unit: commodity.unit,
            source_key: "un_comtrade",
            source_tier: 1,
            frequency: "annual",
          });
        }
      }
    } catch (e) {
      if (e instanceof ComtradeQuotaExceededError) throw e;
      errors.push(`${commodity.slug}/${country.slug}: ${(e as Error).message}`);
    }
    await delay(DELAY_MS);
  }

  return { points, errors };
}

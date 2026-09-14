import type { MetricPoint } from "../metrics/store";
import { EIA_COUNTRIES } from "./eiaApi";

/**
 * UN Comtrade — free, no key, no login "data preview" API for official
 * bilateral trade statistics. Verified live before wiring in:
 * https://comtradeapi.un.org/public/v1/preview/C/A/HS
 *
 * This is what makes the trade network graph real rather than a geographic
 * proxy: genuine country-to-country export values (reported in USD) for
 * crude oil (HS 2709) and natural/petroleum gas (HS 2711), among the same
 * 16-country universe used elsewhere (eiaApi.ts's EIA_COUNTRIES).
 *
 * The preview endpoint has NO documented daily quota but is aggressively
 * rate-limited per request burst (observed 429s after 2-3 rapid calls) and
 * caps each response at 500 records — both handled below: one batched call
 * per reporter (all 15 other countries as partners in a single request,
 * comfortably under the 500-record cap) with a fixed delay and retry-with-
 * backoff between calls. A free registered API key (comtradeplus.un.org)
 * would raise these limits for deeper/more frequent pulls later.
 *
 * Global Energy Trade Network Graph (spec §82-84, 122-123).
 */

const BASE_URL = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

// UN M49 numeric country codes, verified live against comtradeapi.un.org's
// own Reporters reference list for each of the 16 countries.
const UN_COMTRADE_CODES: Record<string, string> = {
  us: "842",
  saudi_arabia: "682",
  russia: "643",
  canada: "124",
  iraq: "368",
  uae: "784",
  iran: "364",
  kuwait: "414",
  qatar: "634",
  norway: "579",
  brazil: "76",
  australia: "36",
  china: "156",
  india: "699",
  japan: "392",
  south_korea: "410",
};

export const TRADE_COMMODITIES: { hsCode: string; slug: string; label: string }[] = [
  { hsCode: "2709", slug: "oil", label: "Crude Petroleum Oil" },
  { hsCode: "2711", slug: "gas", label: "Petroleum Gases (incl. LNG)" },
];

// Oleochemical Trade Flows (Chemicals engine, spec §48/§82) — Malaysia and
// Indonesia together produce ~85% of the world's palm/palm-kernel oil and
// are the dominant oleochemical exporters, but neither is in the 16-country
// universe above (that set was built for the Energy Trade Network). Both
// verified live as working Comtrade reporters before use. HS codes follow
// the spec's own crosswalk notes (oleochemical trade in Malaysia genuinely
// spans HS 15/29/34/38, not one code): 1511 (palm oil), 1513 (palm
// kernel/coconut oil), 3823 (industrial monocarboxylic fatty acids, acid
// oils from refining, and industrial fatty alcohols — the actual
// PFAD/fatty-acid/fatty-alcohol trade classification), 3402 (organic
// surface-active agents / surfactants).
const OLEOCHEM_COMTRADE_CODES: Record<string, string> = {
  malaysia: "458",
  indonesia: "360",
  china: "156",
  india: "699",
  united_states: "842",
  netherlands: "528",
  germany: "276",
  pakistan: "586",
  japan: "392",
  south_korea: "410",
};

export const OLEOCHEMICAL_TRADE_COMMODITIES: { hsCode: string; slug: string; label: string }[] = [
  { hsCode: "1511", slug: "palm_oil", label: "Palm Oil (HS 1511)" },
  { hsCode: "1513", slug: "palm_kernel_coconut_oil", label: "Palm Kernel/Coconut Oil (HS 1513)" },
  { hsCode: "3823", slug: "fatty_acids", label: "Industrial Fatty Acids/Acid Oils/Fatty Alcohols (HS 3823)" },
  { hsCode: "3402", slug: "surfactants", label: "Organic Surface-Active Agents (HS 3402)" },
  // Added for the oleochemicals value-chain build-out (spec §21/§82 HS
  // crosswalk) — each verified live for both the US (the findLatestAvailableYear
  // probe reporter) and Malaysia/Indonesia before being wired in.
  { hsCode: "290545", slug: "glycerine", label: "Glycerol/Glycerine, Crude (HS 2905.45)" },
  { hsCode: "3826", slug: "fame_biodiesel", label: "Biodiesel & FAME Mixtures (HS 3826)" },
  { hsCode: "340120", slug: "soap_noodles", label: "Soap, Other Forms incl. Noodles (HS 3401.20)" },
];

type ComtradeRow = {
  reporterCode: number;
  partnerCode: number;
  flowCode: string;
  period: string;
  primaryValue: number | null;
  motCode: number;
  partner2Code: number;
  qtyUnitCode?: number;
  netWgt?: number | null;
};
type ComtradeResponse = { data?: ComtradeRow[] };

// The two dominant oleochemical exporters (spec §44/45), reused for the
// world-aggregate export/import trend queries below.
const OLEOCHEM_TREND_REPORTERS: { slug: string; code: string }[] = [
  { slug: "malaysia", code: OLEOCHEM_COMTRADE_CODES.malaysia },
  { slug: "indonesia", code: OLEOCHEM_COMTRADE_CODES.indonesia },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comtradeQuery(params: { reporterCode: string; partnerCode: string; period: string; cmdCode: string }): Promise<ComtradeRow[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("reporterCode", params.reporterCode);
  url.searchParams.set("partnerCode", params.partnerCode);
  url.searchParams.set("period", params.period);
  url.searchParams.set("cmdCode", params.cmdCode);

  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (res.status === 429) {
      if (attempt === 2) throw new Error(`UN Comtrade: rate limited after retries (cmd ${params.cmdCode}, reporter ${params.reporterCode})`);
      await delay(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`UN Comtrade: HTTP ${res.status} (cmd ${params.cmdCode}, reporter ${params.reporterCode})`);
    const json = (await res.json()) as ComtradeResponse;
    return json.data ?? [];
  }
  return [];
}

async function findLatestAvailableYear(cmdCode: string): Promise<string> {
  const currentYear = new Date().getUTCFullYear();
  for (let y = currentYear - 1; y >= currentYear - 4; y--) {
    const rows = await comtradeQuery({ reporterCode: "842", partnerCode: "0", period: String(y), cmdCode });
    if (rows.some((r) => r.flowCode === "X" && r.motCode === 0 && r.partner2Code === 0 && r.primaryValue !== null)) return String(y);
    await delay(1500);
  }
  throw new Error(`UN Comtrade: no export data found for cmdCode ${cmdCode} in the last 4 years`);
}

export async function fetchUnComtradeEnergyFlows(): Promise<MetricPoint[]> {
  const slugByCode = new Map(Object.entries(UN_COMTRADE_CODES).map(([slug, code]) => [code, slug]));
  const allCodes = EIA_COUNTRIES.map((c) => UN_COMTRADE_CODES[c.slug]).filter((c): c is string => Boolean(c));

  const points: MetricPoint[] = [];
  for (const commodity of TRADE_COMMODITIES) {
    const year = await findLatestAvailableYear(commodity.hsCode);
    await delay(1500);
    // Batch reporters in groups of 4 (both dimensions accept comma-separated
    // codes) rather than one call per reporter — cuts ~16 calls down to ~4
    // per commodity, which is what keeps this stage inside its 150s budget
    // given the preview endpoint's aggressive per-request rate limiting.
    // Each group stays comfortably under the endpoint's 500-record cap
    // (4 reporters * 16 partners * a handful of flow-code variants).
    const REPORTER_CHUNK_SIZE = 4;
    // Comtrade can report more than one "X" (export) row for the same
    // reporter/partner pair — split by customs procedure or mode of
    // transport (motCode) AND cross-tabbed again by a secondary-partner
    // dimension (partner2Code) — both are already-included subsets of the
    // canonical grand total, so summing every "X" row (as an earlier
    // version of this connector did) silently ~4x'd every trade value.
    // motCode===0 && partner2Code===0 is Comtrade's own "all modes, no
    // secondary partner" grand-total row — exactly one per reporter/partner
    // pair, which is also what keeps upsertMetrics' single-batch upsert
    // from ever touching the same (metric_key, observed_at, source_id) row
    // twice in one call.
    const valueByPair = new Map<string, number>();
    for (let i = 0; i < allCodes.length; i += REPORTER_CHUNK_SIZE) {
      const reporterChunk = allCodes.slice(i, i + REPORTER_CHUNK_SIZE);
      const rows = await comtradeQuery({ reporterCode: reporterChunk.join(","), partnerCode: allCodes.join(","), period: year, cmdCode: commodity.hsCode });
      for (const row of rows) {
        if (row.flowCode !== "X" || row.motCode !== 0 || row.partner2Code !== 0) continue;
        if (row.primaryValue === null || Number.isNaN(row.primaryValue) || row.primaryValue <= 0) continue;
        const reporterSlug = slugByCode.get(String(row.reporterCode));
        const partnerSlug = slugByCode.get(String(row.partnerCode));
        if (!reporterSlug || !partnerSlug || reporterSlug === partnerSlug) continue;
        const pairKey = `${reporterSlug}_to_${partnerSlug}`;
        valueByPair.set(pairKey, row.primaryValue);
      }
      await delay(2000);
    }
    for (const [pairKey, value] of valueByPair) {
      points.push({
        metric_key: `energy.trade.${commodity.slug}.${pairKey}`,
        observed_at: `${year}-12-31`,
        value,
        unit: "USD",
        source_key: "un_comtrade",
        source_tier: 1,
        frequency: "annual",
      });
    }
  }
  return points;
}

/** Pulls the grand-total (motCode=0, partner2Code=0) export (X) and import
 * (M) rows out of a world-aggregate (partnerCode=0) Comtrade response,
 * keeping the declared weight (netWgt, kilograms — verified live against
 * Comtrade's own QuantityUnits reference table: qtyUnitCode 8 = "Weight in
 * kilograms") alongside the declared trade value. Dividing value by weight
 * gives a genuine customs unit price ($/mt), not a market spot price, but a
 * real one — computed from the same declared customs data as the trade
 * flows above, not fabricated. Only trusted when qtyUnitCode is exactly 8;
 * any other unit is left null rather than silently treated as kilograms. */
function extractTradeTrendTotals(rows: ComtradeRow[]): {
  exportValueUsd: number | null;
  exportQtyKg: number | null;
  importValueUsd: number | null;
  importQtyKg: number | null;
} {
  let exportValueUsd: number | null = null;
  let exportQtyKg: number | null = null;
  let importValueUsd: number | null = null;
  let importQtyKg: number | null = null;
  for (const row of rows) {
    if (row.motCode !== 0 || row.partner2Code !== 0) continue;
    if (row.primaryValue === null || Number.isNaN(row.primaryValue) || row.primaryValue <= 0) continue;
    const qtyKg = row.qtyUnitCode === 8 && row.netWgt && row.netWgt > 0 ? row.netWgt : null;
    if (row.flowCode === "X") {
      exportValueUsd = row.primaryValue;
      exportQtyKg = qtyKg;
    } else if (row.flowCode === "M") {
      importValueUsd = row.primaryValue;
      importQtyKg = qtyKg;
    }
  }
  return { exportValueUsd, exportQtyKg, importValueUsd, importQtyKg };
}

/** Fetches one (commodity, reporter, year)'s world-aggregate export/import
 * value + weight — a single Comtrade call returns both flow directions at
 * once (partnerCode=0 already includes both X and M grand-total rows, see
 * live verification notes above), so this is one HTTP request per
 * reporter/year, not two. Used both by the ongoing per-run ingest (current
 * year only, appended below) and by the one-time historical backfill script. */
export async function fetchOleochemicalTradeTrendYear(
  hsCode: string,
  slug: string,
  reporterSlug: string,
  reporterCode: string,
  year: string
): Promise<MetricPoint[]> {
  const rows = await comtradeQuery({ reporterCode, partnerCode: "0", period: year, cmdCode: hsCode });
  const totals = extractTradeTrendTotals(rows);
  const prefix = `chemical.oleochemical_trade_trend.${slug}.${reporterSlug}`;
  const observedAt = `${year}-12-31`;
  const points: MetricPoint[] = [];
  const push = (suffix: string, value: number | null, unit: string) => {
    if (value !== null) points.push({ metric_key: `${prefix}.${suffix}`, observed_at: observedAt, value, unit, source_key: "un_comtrade", source_tier: 1, frequency: "annual" });
  };
  push("export.value_usd", totals.exportValueUsd, "USD");
  push("export.qty_kg", totals.exportQtyKg, "kg");
  push("import.value_usd", totals.importValueUsd, "USD");
  push("import.qty_kg", totals.importQtyKg, "kg");
  return points;
}

/** Fetches ONE commodity's oleochemical trade flows. Split out from the
 * batch loop below so the caller (ingest.ts) can upsert each commodity's
 * points to Supabase as soon as they land, rather than waiting for all 7 HS
 * codes to finish — going from 4 to 7 codes pushed a single pipeline run
 * close enough to (and once, past) the 150s stage timeout that a single
 * slow/rate-limited commodity could otherwise cost the whole stage's
 * already-fetched data, not just its own. */
export async function fetchUnComtradeOleochemicalFlowsForCommodity(commodity: { hsCode: string; slug: string; label: string }): Promise<MetricPoint[]> {
  const slugByCode = new Map(Object.entries(OLEOCHEM_COMTRADE_CODES).map(([slug, code]) => [code, slug]));
  const allCodes = Object.values(OLEOCHEM_COMTRADE_CODES);

  const year = await findLatestAvailableYear(commodity.hsCode);
  await delay(1500);
  const REPORTER_CHUNK_SIZE = 4;
  const valueByPair = new Map<string, number>();
  for (let i = 0; i < allCodes.length; i += REPORTER_CHUNK_SIZE) {
    const reporterChunk = allCodes.slice(i, i + REPORTER_CHUNK_SIZE);
    const rows = await comtradeQuery({ reporterCode: reporterChunk.join(","), partnerCode: allCodes.join(","), period: year, cmdCode: commodity.hsCode });
    for (const row of rows) {
      if (row.flowCode !== "X" || row.motCode !== 0 || row.partner2Code !== 0) continue;
      if (row.primaryValue === null || Number.isNaN(row.primaryValue) || row.primaryValue <= 0) continue;
      const reporterSlug = slugByCode.get(String(row.reporterCode));
      const partnerSlug = slugByCode.get(String(row.partnerCode));
      if (!reporterSlug || !partnerSlug || reporterSlug === partnerSlug) continue;
      const pairKey = `${reporterSlug}_to_${partnerSlug}`;
      valueByPair.set(pairKey, row.primaryValue);
    }
    await delay(2000);
  }

  const points: MetricPoint[] = [];
  for (const [pairKey, value] of valueByPair) {
    points.push({
      metric_key: `chemical.oleochemical_trade.${commodity.slug}.${pairKey}`,
      observed_at: `${year}-12-31`,
      value,
      unit: "USD",
      source_key: "un_comtrade",
      source_tier: 1,
      frequency: "annual",
    });
  }

  // World-aggregate export/import value+weight trend for Malaysia/Indonesia
  // (spec-adjacent: a genuine customs unit price, see extractTradeTrendTotals
  // above) — reuses the same probed `year`, so no extra year-probe calls.
  // Isolated in its own try/catch per reporter: a failure here must never
  // cost the bilateral network points already gathered above.
  for (const reporter of OLEOCHEM_TREND_REPORTERS) {
    await delay(1500);
    try {
      const trendPoints = await fetchOleochemicalTradeTrendYear(commodity.hsCode, commodity.slug, reporter.slug, reporter.code, year);
      points.push(...trendPoints);
    } catch {
      // best-effort — the bilateral trade-flow points above are this
      // function's primary output and are already safe regardless.
    }
  }

  return points;
}

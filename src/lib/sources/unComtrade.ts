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

type ComtradeRow = { reporterCode: number; partnerCode: number; flowCode: string; period: string; primaryValue: number | null };
type ComtradeResponse = { data?: ComtradeRow[] };

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
    if (rows.some((r) => r.flowCode === "X" && r.primaryValue !== null)) return String(y);
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
    for (const reporterSlug of EIA_COUNTRIES.map((c) => c.slug)) {
      const reporterCode = UN_COMTRADE_CODES[reporterSlug];
      if (!reporterCode) continue;
      const partnerCodes = allCodes.filter((c) => c !== reporterCode);
      const rows = await comtradeQuery({ reporterCode, partnerCode: partnerCodes.join(","), period: year, cmdCode: commodity.hsCode });
      for (const row of rows) {
        if (row.flowCode !== "X" || row.primaryValue === null || Number.isNaN(row.primaryValue) || row.primaryValue <= 0) continue;
        const partnerSlug = slugByCode.get(String(row.partnerCode));
        if (!partnerSlug) continue;
        points.push({
          metric_key: `energy.trade.${commodity.slug}.${reporterSlug}_to_${partnerSlug}`,
          observed_at: `${year}-12-31`,
          value: row.primaryValue,
          unit: "USD",
          source_key: "un_comtrade",
          source_tier: 1,
          frequency: "annual",
        });
      }
      await delay(1500);
    }
  }
  return points;
}

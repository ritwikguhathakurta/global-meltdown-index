import type { MetricPoint } from "../metrics/store";
import { CHEMICAL_PRODUCTS, priceHsCodesFor, type ChemicalPriceHsCodes } from "../commodities/chemicalProductsDatabase";

/**
 * Average export/import unit value (declared customs value ÷ net weight)
 * for every Chemical Products Master row that has an HS code but no FRED PPI
 * proxy (chemicalProductsDatabase.ts's livePriceMetricKey) — a genuine,
 * real-data price proxy, not invented: UN Comtrade unit values are a
 * standard, widely-used way to approximate a commodity's average price when
 * no dedicated spot-price series exists free (the same reason ICIS/Platts/
 * ChemAnalyst spot prices are paywalled — see fred.ts's own doc comment on
 * the PPI proxies this fills the gap around).
 *
 * Uses ONE reference reporter (the United States, code 842 — the same
 * reference reporter unComtrade.ts's findLatestAvailableYear already uses)
 * rather than summing every country the way the country-balance connector
 * (unComtradeCommodityTrade.ts) does: that connector needs each country's
 * own production/trade to build a balance sheet, but this one only needs
 * ONE consistently-reporting, high-volume trader's own declared trade to
 * approximate a representative global price — at a small fraction of the
 * API-call cost (one call per HS code here, ~46 distinct codes total, vs.
 * ~150-180 (country, commodity) pairs there).
 *
 * Monthly data (Comtrade's C/M/HS dataset), matching the FRED PPI proxies'
 * own cadence — an earlier version of this connector used the annual C/A/HS
 * dataset, which meant a full calendar year's average (2025, with 2026 not
 * yet complete) sat next to PPI rows already showing "Aug 2026." Switched to
 * monthly, live-verified first: US Census trade data has its own release
 * lag distinct from (and longer than) the PPI's, so the freshest available
 * month here trails a couple of months behind "today" and behind the PPI
 * rows' own latest month — confirmed live at build time that July 2026 was
 * the newest month with usable data anywhere across several test HS codes,
 * with August not yet published by any source. This always fetches
 * whichever month is actually newest, so it rolls forward to August (and
 * beyond) automatically as the Census releases each one, without a code
 * change.
 */

const BASE_URL = "https://comtradeapi.un.org/data/v1/get/C/M/HS";
const SUBSCRIPTION_KEY = process.env.UN_COMTRADE_SUBSCRIPTION_KEY;
const REFERENCE_REPORTER = "842"; // United States

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

/** Same daily-quota-exhausted signal as unComtradeCommodityTrade.ts's own
 * error of the same name (kept as a separate class here, not a shared
 * import, so this connector's callers can catch exactly this connector's
 * failures without coupling the two source files together). */
export class ChemicalPriceQuotaExceededError extends Error {}

async function comtradeQuery(cmdCode: string, period: string): Promise<ComtradeRow[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("reporterCode", REFERENCE_REPORTER);
  url.searchParams.set("partnerCode", "0");
  url.searchParams.set("period", period);
  url.searchParams.set("cmdCode", cmdCode);
  const headers: HeadersInit | undefined = SUBSCRIPTION_KEY ? { "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY } : undefined;

  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetch(url.toString(), { next: { revalidate: 0 }, headers });
    if (res.status === 403) {
      const body = await res.text().catch(() => "");
      throw new ChemicalPriceQuotaExceededError(`UN Comtrade quota exceeded: ${body || "HTTP 403"}`);
    }
    if (res.status === 429) {
      if (attempt === 2) throw new Error(`rate limited after retries (cmd ${cmdCode})`);
      await delay(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} (cmd ${cmdCode})`);
    const json = (await res.json()) as ComtradeResponse;
    return json.data ?? [];
  }
  return [];
}

export const CHEMICAL_PRICE_DELAY_MS = SUBSCRIPTION_KEY ? 350 : 1500;

function unitValueForFlow(rows: ComtradeRow[], period: string, flowCode: "X" | "M"): number | null {
  const row = rows.find((r) => r.period === period && r.flowCode === flowCode && r.motCode === 0 && r.partner2Code === 0 && r.qtyUnitCode === 8);
  if (!row || !row.netWgt || row.netWgt <= 0 || row.primaryValue === null) return null;
  return row.primaryValue / row.netWgt; // USD/kg
}

/** The last `count` fully-elapsed calendar months as Comtrade YYYYMM period
 * strings, most recent first — starts at LAST month, not the current one
 * (which can't have a complete customs release yet). */
function recentMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (i + 1), 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function lastDayOfMonthIso(yyyymm: string): string {
  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}

export type ChemicalPriceHsCodeGroup = ChemicalPriceHsCodes & { slugs: string[] };

/** Distinct (primary, fallback) HS code pairs needed, deduped across every
 * product lacking a PPI price — several rows share one code (e.g. every
 * fatty acid the WCO doesn't name individually maps to the same HS 382319
 * "other" subheading), so this is fetched once per code pair, not once per
 * product. */
export function getChemicalPriceHsCodes(): ChemicalPriceHsCodeGroup[] {
  const byPrimary = new Map<string, ChemicalPriceHsCodeGroup>();
  for (const p of CHEMICAL_PRODUCTS) {
    const codes = priceHsCodesFor(p);
    if (!codes) continue;
    const existing = byPrimary.get(codes.primary);
    if (existing) existing.slugs.push(p.slug);
    else byPrimary.set(codes.primary, { ...codes, slugs: [p.slug] });
  }
  return [...byPrimary.values()];
}

export function chemicalHsMetricKey(hsCode: string, flow: "export" | "import"): string {
  return `chemical.hs.${hsCode}.${flow}_unit_value`;
}

/** Fetches one HS code's most recent export AND import unit value (both, not
 * either/or — a chemical the US mostly imports still gets a real reference
 * price from its import side) in a single Comtrade call covering the last 12
 * candidate months. Metric keys are stamped with the code actually queried,
 * so a fallback-sourced point is honestly labeled as coming from the
 * fallback code, not silently attributed to the primary one. */
async function fetchUnitValueForCode(hsCode: string): Promise<MetricPoint[]> {
  const months = recentMonths(12);
  const rows = await comtradeQuery(hsCode, months.join(","));

  const points: MetricPoint[] = [];
  for (const flow of ["X", "M"] as const) {
    for (const month of months) {
      const usdPerKg = unitValueForFlow(rows, month, flow);
      if (usdPerKg === null) continue;
      points.push({
        metric_key: chemicalHsMetricKey(hsCode, flow === "X" ? "export" : "import"),
        observed_at: lastDayOfMonthIso(month),
        value: usdPerKg * 1000, // USD/MT — matches this app's other chemical/commodity price units
        unit: "USD/MT",
        source_key: "un_comtrade",
        source_tier: 1,
        frequency: "monthly",
      });
      break; // only the newest month with usable data for this flow
    }
  }
  return points;
}

/** Tries the primary (usually more specific) HS code first; if the
 * reference reporter reports nothing at all for it, falls back to the
 * broader code — confirmed live as a real, not hypothetical, case: Sodium
 * Laureth Sulfate's own 6-digit code (340213) returns zero rows for the
 * United States, so it correctly falls back to the broader HS 3402 heading
 * rather than showing no price at all. */
export async function fetchChemicalHsUnitValue(codes: ChemicalPriceHsCodes): Promise<MetricPoint[]> {
  const primaryPoints = await fetchUnitValueForCode(codes.primary);
  if (primaryPoints.length > 0 || !codes.fallback) return primaryPoints;
  await delay(CHEMICAL_PRICE_DELAY_MS);
  return fetchUnitValueForCode(codes.fallback);
}

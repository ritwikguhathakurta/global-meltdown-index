import type { MetricPoint } from "../metrics/store";
import { COMMODITIES } from "../commodities/taxonomy";
import { fetchWorkbookSheet } from "./xlsWorkbook";

/**
 * World Bank Commodity Price Data ("The Pink Sheet") — free, no key, no
 * login. Monthly nominal-USD prices for commodities since 1960, updated
 * monthly. Verified live before wiring in: the download link is scraped
 * from the World Bank's own commodity-markets page (not guessed/hardcoded)
 * since the hash in the URL path changes across releases.
 *
 * https://www.worldbank.org/en/research/commodity-markets
 *
 * Commodities engine, Phase 1 (spec's Commodity Intelligence Platform,
 * §13 WorldBankCommodityPriceConnector) — this single file covers most of
 * the spec's Energy/Base Metals/Precious Metals/Grains/Oilseeds/Soft
 * Commodities/Livestock/Fertilizers taxonomy (see taxonomy.ts). Critical
 * minerals (Lithium, Cobalt, Graphite, Manganese, Rare Earths, Vanadium,
 * Tungsten, Molybdenum) were checked directly against this file and have no
 * column — disclosed as a gap, not substituted.
 */

const LANDING_PAGE_URL = "https://www.worldbank.org/en/research/commodity-markets";

async function findMonthlyXlsxUrl(): Promise<string> {
  const res = await fetch(LANDING_PAGE_URL, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`World Bank commodity-markets page: HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(/https:\/\/thedocs\.worldbank\.org\/[^"'\s]*CMO-Historical-Data-Monthly\.xlsx/);
  if (!match) throw new Error("World Bank Pink Sheet: monthly xlsx link not found on landing page");
  return match[0];
}

function excelSerialToIsoDate(period: string): string | null {
  // Period cells read as "1960M01" style strings in this workbook.
  const m = period.match(/^(\d{4})M(\d{2})$/);
  if (!m) return null;
  const [, year, month] = m;
  return `${year}-${month}-01`;
}

export async function fetchWorldBankCommodityPrices(sinceIso: string): Promise<MetricPoint[]> {
  const xlsxUrl = await findMonthlyXlsxUrl();
  const rows = (await fetchWorkbookSheet(xlsxUrl, "Monthly Prices")) as (string | number | null)[][];

  // Row 4 (0-indexed) is the commodity-name header, row 5 is units, data starts row 6.
  const headerRow = rows[4];
  if (!headerRow || typeof headerRow[1] !== "string") throw new Error("World Bank Pink Sheet: unexpected header layout");

  const points: MetricPoint[] = [];
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r];
    const period = row?.[0];
    if (typeof period !== "string") continue;
    const observedAt = excelSerialToIsoDate(period);
    if (!observedAt || observedAt < sinceIso) continue;

    for (const commodity of COMMODITIES) {
      const raw = row[commodity.pinkSheetColumn];
      if (raw === undefined || raw === null || raw === "…" || raw === "...") continue;
      const value = typeof raw === "number" ? raw : parseFloat(String(raw));
      if (Number.isNaN(value)) continue;
      points.push({
        metric_key: `commodity.${commodity.slug}.price`,
        observed_at: observedAt,
        value,
        unit: commodity.unit,
        source_key: "world_bank_commodities",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  }
  return points;
}

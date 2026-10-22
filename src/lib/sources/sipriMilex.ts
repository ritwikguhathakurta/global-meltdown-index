import * as XLSX from "xlsx";
import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * SIPRI Military Expenditure Database — free, official, direct .xlsx download,
 * annual since 1949. Verified live (2026-09-29):
 *
 *   https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx
 *
 * The filename embeds a version/year suffix that changes on SIPRI's own release
 * schedule (v1.2 covering 1949-2025 as of this check), so the exact URL is
 * re-discovered each run from the database's own landing page rather than
 * hardcoded — the same "don't guess a dated filename" lesson as taifexDerivatives.ts.
 *
 * "Share of GDP" sheet: header row 6 (0-indexed 5) is Country, Notes, then one
 * column per year (1949-2025). Values are fractions (0.034 = 3.4% of GDP), not
 * already-scaled percentages — multiplied by 100 here. The FULL back-series is
 * emitted per country (not just the latest year) — the whole sheet is already
 * fetched and parsed, so backfilling all ~77 published years in one run costs
 * nothing extra and immediately gives real deep history for z-scoring, the
 * same "fetch it once, keep everything" choice as ingestWorldBankCommodities
 * and ingestEnergyBacktestSeries (see CLAUDE.md's lookback-window note).
 * SIPRI marks unpublished/uncertain cells with "..", "xxx", or leaves them
 * blank rather than estimating; this connector skips those cells too, never
 * guessing a value.
 */
const LANDING_PAGE = "https://www.sipri.org/databases/milex";
const SHEET_NAME = "Share of GDP";
const HEADER_ROW = 5;

export const SIPRI_COUNTRIES: { name: string; slug: string }[] = [
  { name: "United States of America", slug: "usa" },
  { name: "China", slug: "china" },
  { name: "Russia", slug: "russia" },
  { name: "India", slug: "india" },
  { name: "United Kingdom", slug: "uk" },
  { name: "France", slug: "france" },
  { name: "Germany", slug: "germany" },
  { name: "Japan", slug: "japan" },
  { name: "Korea, South", slug: "south_korea" },
  { name: "Saudi Arabia", slug: "saudi_arabia" },
  { name: "Israel", slug: "israel" },
  { name: "Iran", slug: "iran" },
  { name: "Türkiye", slug: "turkey" },
  { name: "Pakistan", slug: "pakistan" },
  { name: "Ukraine", slug: "ukraine" },
  { name: "Poland", slug: "poland" },
  { name: "Taiwan", slug: "taiwan" },
  { name: "Brazil", slug: "brazil" },
  { name: "Australia", slug: "australia" },
  { name: "Egypt", slug: "egypt" },
];

async function findWorkbookUrl(): Promise<string> {
  const res = await fetchRetry(LANDING_PAGE, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`SIPRI Milex landing page: HTTP ${res.status}`);
  const html = await res.text();
  const m = /href="(\/\/[^"]*SIPRI-Milex-data[^"]*\.xlsx)"/.exec(html);
  if (!m) throw new Error("SIPRI Milex landing page: no data workbook link found");
  return `https:${m[1]}`;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function fetchSipriMilex(): Promise<MetricPoint[]> {
  const url = await findWorkbookUrl();
  const res = await fetchRetry(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`SIPRI Milex workbook: HTTP ${res.status}`);
  const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`SIPRI Milex workbook: sheet "${SHEET_NAME}" not found`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const header = rows[HEADER_ROW];

  const points: MetricPoint[] = [];
  for (const { name, slug } of SIPRI_COUNTRIES) {
    const row = rows.find((r) => r[0] === name);
    if (!row) continue;
    for (let col = 2; col < header.length; col++) {
      const year = header[col];
      if (typeof year !== "number") continue;
      const pct = num(row[col]);
      if (pct === null) continue;
      points.push({
        metric_key: `geopolitical.military_spend_pct_gdp.${slug}`,
        observed_at: `${year}-12-31`,
        value: pct * 100,
        unit: "% of GDP",
        source_key: "sipri_milex",
        source_tier: 1,
        frequency: "annual",
      });
    }
  }
  if (points.length === 0) throw new Error("SIPRI Milex: no data parsed for any tracked country");
  return points;
}

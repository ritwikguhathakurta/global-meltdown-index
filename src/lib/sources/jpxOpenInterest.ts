import * as XLSX from "xlsx";
import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * JPX (Japan Exchange Group / Osaka Exchange) daily derivatives open interest — a free public
 * workbook linked from the JPX trading-volume page, refreshed each trading day:
 *
 *   https://www.jpx.co.jp/english/markets/derivatives/trading-volume/index.html
 *   -> href ending "open_interest_e.xlsx" (path includes a content id, so the index page is
 *      scraped fresh each run rather than guessing the URL from today's date)
 *
 * CORRECTS an earlier disclosure in docs/DERIVATIVES_ENGINE.md that JPX's "comprehensive
 * open-interest data requires a paid data-services contract" — that was checked against JPX's
 * options-history CSV, not this workbook. Verified live (2026-09-29): a real daily "OSE Index
 * Futures"/"OSE Index Options" breakdown with Current Day Open Interest for Nikkei 225, TOPIX,
 * their mini/micro variants, and Nikkei 225/TOPIX options Put/Call OI — genuine free Tier 1
 * exchange data, the same kind of "Phase 1 wrongly concluded didn't exist" gap that
 * nseFoBhavcopy.ts/dtccSwapData.ts found for other exchanges (see that doc's "Phase 2
 * additions" section).
 *
 * Layout: the sheet lays two independent tables side by side (columns 0-5 and 7-12), each row
 * being [Name, Label, Volume, "Current Day Open Interest", Change, "Previous Day Open Interest"].
 * A futures block's Name appears once, followed by one row per contract month, ending in a
 * Label==="Total" row holding the summed OI. An options block's Name row has Label==="Put",
 * immediately followed by a Label==="Call" row — both hold that side's OI directly (no summing
 * needed). Extraction is by exact (whitespace-normalized) target name, not blind aggregation,
 * matching this project's other exchange-workbook connectors (taifexDerivatives.ts,
 * cffexDerivatives.ts) rather than parsing every row on the sheet.
 */
const INDEX_URL = "https://www.jpx.co.jp/english/markets/derivatives/trading-volume/index.html";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };
const SHEET_NAME = "JPX Derivatives Open Interest";
const COLUMN_OFFSETS = [0, 7];

const FUTURES_TARGETS = [
  { name: "Nikkei 225", slug: "nikkei225" },
  { name: "TOPIX", slug: "topix" },
  { name: "Nikkei 225 mini", slug: "nikkei225_mini" },
  { name: "Nikkei 225 Micro Futures", slug: "nikkei225_micro" },
  { name: "mini-TOPIX", slug: "topix_mini" },
];
const OPTIONS_TARGETS = [
  { name: "Nikkei 225 Options", slug: "nikkei225_options" },
  { name: "Nikkei 225 mini Options", slug: "nikkei225_mini_options" },
  { name: "TOPIX Options", slug: "topix_options" },
];

type Row = [string, string, unknown, unknown, unknown, unknown];

const normalize = (v: unknown): string => String(v ?? "").replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function buildView(rows: unknown[][], offset: number): Row[] {
  return rows.map((r) => [normalize(r[offset]), normalize(r[offset + 1]), r[offset + 2], r[offset + 3], r[offset + 4], r[offset + 5]] as Row);
}

function findFuturesOi(view: Row[], name: string): number | null {
  const i = view.findIndex((r) => r[0] === name);
  if (i < 0) return null;
  for (let j = i; j < Math.min(view.length, i + 40); j++) {
    if (view[j][1] === "Total") return num(view[j][3]);
  }
  return null;
}

function findOptionsOi(view: Row[], name: string): { put: number; call: number } | null {
  const i = view.findIndex((r) => r[0] === name && r[1] === "Put");
  if (i < 0 || i + 1 >= view.length) return null;
  const put = num(view[i][3]);
  const call = num(view[i + 1][3]);
  if (put === null || call === null) return null;
  return { put, call };
}

async function findWorkbookUrl(): Promise<string> {
  const res = await fetchRetry(INDEX_URL, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`JPX trading-volume index page: HTTP ${res.status}`);
  const html = await res.text();
  const m = /href="([^"]*open_interest_e\.xlsx)"/.exec(html);
  if (!m) throw new Error("JPX trading-volume index page: no open_interest_e.xlsx link found");
  return new URL(m[1], INDEX_URL).toString();
}

export async function fetchJpxOpenInterest(): Promise<MetricPoint[]> {
  const fileUrl = await findWorkbookUrl();
  const res = await fetchRetry(fileUrl, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`JPX open interest workbook: HTTP ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`JPX open interest workbook: sheet "${SHEET_NAME}" not found`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  const dateSerial = rows[1]?.[0];
  const parsed = typeof dateSerial === "number" ? XLSX.SSF.parse_date_code(dateSerial) : null;
  if (!parsed) throw new Error("JPX open interest workbook: could not read the data date");
  const observed_at = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;

  const views = COLUMN_OFFSETS.map((o) => buildView(rows, o));
  const base = { observed_at, source_key: "jpx_open_interest", source_tier: 1 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [];

  for (const { name, slug } of FUTURES_TARGETS) {
    const oi = views.map((v) => findFuturesOi(v, name)).find((v): v is number => v !== null && v > 0);
    if (oi !== undefined) points.push({ ...base, metric_key: `derivatives.jpx.${slug}_futures.oi`, value: oi, unit: "contracts" });
  }
  for (const { name, slug } of OPTIONS_TARGETS) {
    const oi = views.map((v) => findOptionsOi(v, name)).find((v): v is { put: number; call: number } => v !== null);
    if (oi && oi.call > 0) {
      points.push({ ...base, metric_key: `derivatives.jpx.${slug}.call_oi`, value: oi.call, unit: "contracts" });
      points.push({ ...base, metric_key: `derivatives.jpx.${slug}.put_oi`, value: oi.put, unit: "contracts" });
      points.push({ ...base, metric_key: `derivatives.jpx.${slug}.pcr_oi`, value: oi.put / oi.call, unit: "ratio" });
    }
  }
  if (points.length === 0) throw new Error("JPX open interest workbook: none of the target underlyings were found");
  return points;
}

import * as XLSX from "xlsx";
import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * Montréal Exchange (TMX, Canada) daily options summary — a free public workbook linked from
 * m-x.ca/en/trading/data, refreshed each trading day:
 *
 *   https://www.m-x.ca/files/options-summary-en.xlsx
 *
 * Verified live (2026-09-25, data date 2026-09-24): one row per listed equity-option contract
 * (expiry, strike, Call/Put, volume, open interest, implied volatility), grouped under each
 * underlying, with "Total" subtotal rows. Summed across every Call and Put row into a
 * whole-market Canadian equity-options put/call open-interest ratio and volume ratio, the
 * Canadian counterpart to hkexDerivatives.ts / nseFoBhavcopy.ts. Numbers arrive as either
 * numbers or comma-formatted strings ("2,225"). Subtotal and underlying header rows are
 * skipped by requiring the Call/Put column to say exactly "Call" or "Put".
 */
const FILE_URL = "https://www.m-x.ca/files/options-summary-en.xlsx";
// The CDN serves this file with max-age=604800 and (verified) returned a week-old copy for the bare URL, so a
// unique query string is appended to fetch the current one.
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  const x = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

function parseDate(text: string): string | null {
  const m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text.trim());
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

export async function fetchMxOptions(): Promise<MetricPoint[]> {
  const res = await fetchRetry(`${FILE_URL}?t=${Date.now()}`, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Montréal Exchange options summary: HTTP ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const observed_at = parseDate(String(rows[0]?.[0] ?? ""));
  if (!observed_at) throw new Error("Montréal Exchange options summary: could not read the data date");

  let callOi = 0;
  let putOi = 0;
  let callVol = 0;
  let putVol = 0;
  for (const r of rows.slice(2)) {
    const side = String(r[2] ?? "").trim();
    if (side === "Call") {
      callOi += num(r[7]);
      callVol += num(r[4]);
    } else if (side === "Put") {
      putOi += num(r[7]);
      putVol += num(r[4]);
    }
  }
  if (callOi <= 0) throw new Error("Montréal Exchange options summary: no call open interest parsed");
  const base = { observed_at, source_key: "mx_options", source_tier: 1 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [
    { ...base, metric_key: "derivatives.mx.options.call_oi", value: callOi, unit: "contracts" },
    { ...base, metric_key: "derivatives.mx.options.put_oi", value: putOi, unit: "contracts" },
    { ...base, metric_key: "derivatives.mx.options.pcr_oi", value: putOi / callOi, unit: "ratio" },
  ];
  if (callVol > 0) points.push({ ...base, metric_key: "derivatives.mx.options.pcr_volume", value: putVol / callVol, unit: "ratio" });
  return points;
}

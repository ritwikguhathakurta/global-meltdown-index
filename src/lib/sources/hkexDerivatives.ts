import AdmZip from "adm-zip";
import type { MetricPoint } from "../metrics/store";

/**
 * HKEX (Hong Kong Exchanges and Clearing) "Daily Trading Activity & Open
 * Positions Summary" (DTOP) — free, no key, no login, published same
 * evening for every trading day at:
 *
 *   https://www.hkex.com.hk/eng/stat/dmstat/oi/DTOP_F_<yyyymmdd>.zip   (futures)
 *   https://www.hkex.com.hk/eng/stat/dmstat/oi/DTOP_O_<yyyymmdd>.zip   (options)
 *
 * Verified live (2026-09-22): each zip contains real per-instrument,
 * per-expiry fixed-width text reports with genuine Gross/Net Open Interest,
 * turnover and deal counts straight from HKEX's own clearing system (HKCC
 * for futures, SEOCH for stock options) — not a scrape of a rendered page.
 *
 * Futures: only the three Hang Seng family index futures are aggregated
 * (HSI, HHI/H-shares, MHI/Mini-HSI) — HIBOR/RMB/other product files exist in
 * the same zip but are out of scope for this pass. Each instrument's total
 * Gross OI is the sum of GROSS across every listed expiry in its `.rpt`.
 *
 * Options: rather than parsing ~150 individual per-underlying `.rpt` files,
 * this reads the one `..._summary.rpt` file's per-underlying CALL/PUT OI
 * lines directly (skips any "MARKET TOTAL" subtotal lines to avoid double-
 * counting) and sums them into a whole-market Hong Kong equity/index options
 * Gross Call OI and Gross Put OI — a real, market-wide put/call ratio
 * analogous to NSE India's PCR (see nseFoBhavcopy.ts).
 */

const HKEX_BASE = "https://www.hkex.com.hk/eng/stat/dmstat/oi";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

const FUTURES_INSTRUMENTS = [
  { file: "hsi", slug: "hsi_futures" },
  { file: "hhi", slug: "hhi_futures" },
  { file: "mhi", slug: "mhi_futures" },
];

function dtopUrl(kind: "F" | "O", date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${HKEX_BASE}/DTOP_${kind}_${yyyy}${mm}${dd}.zip`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function downloadZip(kind: "F" | "O", maxLookbackDays = 7): Promise<{ zip: AdmZip; observedAt: string } | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const res = await fetch(dtopUrl(kind, day), { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    // A 200 response doesn't guarantee a well-formed zip — a CDN hiccup can
    // serve a truncated/corrupted body with a success status. Without this
    // catch, AdmZip's constructor throws synchronously and kills the whole
    // lookback instead of falling back to the previous day like a 404 does.
    try {
      return { zip: new AdmZip(buffer), observedAt: isoDate(day) };
    } catch {
      continue;
    }
  }
  return null;
}

/** Sums the GROSS column (2nd numeric field) across every data row of one
 * futures instrument's per-expiry report (skips header/separator lines). */
function sumFuturesGrossOi(reportText: string): number {
  let total = 0;
  for (const line of reportText.split("\n")) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length < 3) continue;
    const gross = parseFloat(parts[2].replace(/,/g, ""));
    if (Number.isFinite(gross)) total += gross;
  }
  return total;
}

const OPTIONS_LINE_RE = /^\s*\S+\s*-\s*(CALL|PUT)\s+OPTIONS\s+([\d,]+)/;

/** Sums Gross OI across every underlying's CALL/PUT lines in the options
 * summary report, skipping "MARKET TOTAL" subtotal lines. */
function sumOptionsGrossOi(reportText: string): { callGross: number; putGross: number } {
  let callGross = 0;
  let putGross = 0;
  for (const line of reportText.split("\n")) {
    if (line.includes("MARKET TOTAL")) continue;
    const m = OPTIONS_LINE_RE.exec(line);
    if (!m) continue;
    const gross = parseFloat(m[2].replace(/,/g, ""));
    if (!Number.isFinite(gross)) continue;
    if (m[1] === "CALL") callGross += gross;
    else putGross += gross;
  }
  return { callGross, putGross };
}

export async function fetchHkexDerivatives(): Promise<MetricPoint[]> {
  const points: MetricPoint[] = [];

  const futuresZip = await downloadZip("F");
  if (futuresZip) {
    for (const { file, slug } of FUTURES_INSTRUMENTS) {
      const entry = futuresZip.zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(`dtl_${file}.rpt`));
      if (!entry) continue;
      const grossOi = sumFuturesGrossOi(entry.getData().toString("utf-8"));
      if (grossOi <= 0) continue;
      points.push({
        metric_key: `derivatives.hkex.${slug}.gross_oi`,
        observed_at: futuresZip.observedAt,
        value: grossOi,
        unit: "contracts",
        source_key: "hkex_derivatives",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }

  const optionsZip = await downloadZip("O");
  if (optionsZip) {
    const entry = optionsZip.zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith("summary.rpt"));
    if (entry) {
      const { callGross, putGross } = sumOptionsGrossOi(entry.getData().toString("utf-8"));
      if (callGross > 0) {
        points.push({
          metric_key: "derivatives.hkex.options.pcr_oi",
          observed_at: optionsZip.observedAt,
          value: putGross / callGross,
          unit: "ratio",
          source_key: "hkex_derivatives",
          source_tier: 1,
          frequency: "daily",
        });
        points.push({
          metric_key: "derivatives.hkex.options.call_gross_oi",
          observed_at: optionsZip.observedAt,
          value: callGross,
          unit: "contracts",
          source_key: "hkex_derivatives",
          source_tier: 1,
          frequency: "daily",
        });
        points.push({
          metric_key: "derivatives.hkex.options.put_gross_oi",
          observed_at: optionsZip.observedAt,
          value: putGross,
          unit: "contracts",
          source_key: "hkex_derivatives",
          source_tier: 1,
          frequency: "daily",
        });
      }
    }
  }

  return points;
}

import type { MetricPoint } from "../metrics/store";

/**
 * Malaysia — MPOB (Malaysian Palm Oil Board) monthly exports of oil palm
 * products. No public REST/JSON API exists: MPOB's own report catalogue
 * (/stat/, /stat/index.php) returns HTTP 401 "Access Restricted", so the
 * numeric report codes for production/stocks/FFB-and-CPO-price are
 * undiscoverable without that catalogue — only this one confirmed-working
 * report is built here. See the Oilseeds page disclosure for what's still
 * missing pending report URLs.
 *
 * Report URL: https://bepi.mpob.gov.my/stat/web_report1.php?val=<val>
 * where val = year*100 + 34 — verified live across 2024/2025/2026 (the "34"
 * report-type code stayed constant, only the year segment changed). Years
 * before 2024 return an empty response body at this code (checked directly
 * via byte-length, not assumed) — MPOB appears to have restructured its
 * report numbering at some point, and the pre-2024 equivalent code is
 * unknown, so history here genuinely starts in 2024, not 10 years back.
 *
 * The page is a plain server-rendered HTML table (no JS rendering needed).
 * Each product occupies two <tr> rows — Tonnes then RM Mil — sharing a
 * rowspan=2 product-name cell on the first row only. Only the Tonnes row is
 * ingested; RM Mil (export value) is left for a future pass.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const PRODUCT_SLUGS: Record<string, string> = {
  CPO: "cpo",
  PPO: "ppo",
  "PALM OIL": "palm_oil",
  CPKO: "cpko",
  PPKO: "ppko",
  "PALM KERNEL OIL": "palm_kernel_oil",
  "PALM KERNEL CAKE": "palm_kernel_cake",
  OLEOCHEMICALS: "oleochemicals",
  "FINISHED PRODUCTS": "finished_products",
  BIODIESEL: "biodiesel",
  OTHERS: "others",
  TOTAL: "total",
};

function extractCells(rowHtml: string): string[] {
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = cellRegex.exec(rowHtml))) {
    const text = m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, "")
      .replace(/,/g, "")
      .trim();
    cells.push(text);
  }
  return cells;
}

export async function fetchMpobMalaysiaExports(): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const points: MetricPoint[] = [];

  for (const year of years) {
    const val = year * 100 + 34;
    const res = await fetch(`https://bepi.mpob.gov.my/stat/web_report1.php?val=${val}`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    });
    if (!res.ok) continue;
    const html = await res.text();
    if (!html.includes("MONTHLY EXPORT OF OIL PALM PRODUCTS")) continue; // year not published under this code — skip, don't guess

    const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
    for (const row of rows) {
      if (!row.includes("rowspan=2")) continue; // only the Tonnes row starts a product block
      const cells = extractCells(row);
      if (cells.length < 15) continue; // PRODUCT, UNIT, 12 months, cumulative

      const productLabel = cells[0].replace(/\s+/g, " ").trim().toUpperCase();
      const slug = PRODUCT_SLUGS[productLabel];
      if (!slug) continue;
      if (cells[1] !== "Tonnes") continue;

      for (let month = 1; month <= 12; month++) {
        const raw = cells[1 + month];
        if (!raw) continue;
        const tonnes = parseFloat(raw);
        if (Number.isNaN(tonnes)) continue;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        points.push({
          metric_key: `commodity.palm_oil.malaysia.export.${slug}`,
          observed_at: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
          value: tonnes / 1_000_000,
          unit: "million MT",
          source_key: "mpob_malaysia",
          source_tier: 1,
          frequency: "monthly",
        });
      }
    }
  }
  return points;
}

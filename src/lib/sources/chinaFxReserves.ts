import type { MetricPoint } from "../metrics/store";
import { fetchWorkbookSheet } from "./xlsWorkbook";

/**
 * China's monthly Official Reserve Assets, published by SAFE (State
 * Administration of Foreign Exchange) — free, official, no key, part of
 * China's IMF SDDS reserves-template reporting. Genuinely fresher than
 * FRED's own IMF-compiled mirror (TRESEGCNM052N, "Total Reserves excluding
 * Gold for China" — see fred.ts): SAFE typically publishes a given month's
 * figures in the first week of the following month (~1-month lag), verified
 * live to be well ahead of FRED's own ~2-3 month lag on the same underlying
 * IMF data.
 *
 * Two figures are extracted from the same monthly workbook:
 *  - china.fx_reserves_usd: item 1, "Foreign currency reserves" alone — the
 *    headline number everyone means by "China's FX reserves" (~$3.3-3.4T as
 *    of mid-2026).
 *  - liquidity.china_reserves_ex_gold: Total (all five reserve components)
 *    minus Gold — deliberately matching FRED's TRESEGCNM052N definition
 *    exactly rather than SAFE's own item-1-only figure (verified: SAFE's
 *    Aug 2026 ex-gold reading of ~$3.50T lines up with FRED's June 2026
 *    reading of ~$3.48T), so this metric key can genuinely extend that
 *    series forward for months FRED hasn't caught up to yet instead of
 *    silently switching definitions mid-series. This is what fills the
 *    previously-empty "Balance Sheet" column on the PBOC (China) row of the
 *    Liquidity dashboard (see liquidityRegime.ts) and feeds into the Global
 *    Liquidity composite (globalLiquidity.ts) as China's balance-sheet-side
 *    quantity input, alongside (not replacing) the existing 3M interbank
 *    rate as its rate-side input.
 *
 * The landing page (safe.gov.cn/en/2021/0203/2045.html) is a permalink that
 * always serves the CURRENT year's release (its own page title carries the
 * year and updates annually); it links out to an .xlsx download whose
 * filename changes every month, so this fetcher reads the landing page
 * first to find that month's actual file before downloading and parsing it
 * — the same two-step discovery pattern as sovereignRiskPremium.ts's own
 * Damodaran workbook fetch, minus the discovery step there since that URL
 * is stable.
 */

const LANDING_URL = "https://www.safe.gov.cn/en/2021/0203/2045.html";

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch(url, { next: { revalidate: 0 }, signal: controller.signal });
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function findCurrentXlsxUrl(): Promise<{ url: string; year: number }> {
  const res = await fetchWithRetry(LANDING_URL);
  const html = await res.text();
  const yearMatch = html.match(/Official Reserve Assets \((\d{4})\)/);
  const hrefMatch = html.match(/href="([^"]+\.xlsx)"/i);
  if (!hrefMatch) throw new Error("SAFE reserves page: no .xlsx link found (page structure may have changed)");
  if (!yearMatch) throw new Error("SAFE reserves page: could not determine the release year from the page title");
  return { url: new URL(hrefMatch[1], LANDING_URL).toString(), year: Number(yearMatch[1]) };
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.trim());
  return Number.isNaN(n) ? null : n;
}

export async function fetchChinaOfficialReserveAssets(): Promise<MetricPoint[]> {
  const { url, year } = await findCurrentXlsxUrl();
  const rows = await fetchWorkbookSheet(url, "Sheet1");

  const fxRow = rows.find((r) => typeof r[0] === "string" && (r[0] as string).includes("外汇储备"));
  const goldRow = rows.find((r) => typeof r[0] === "string" && (r[0] as string).includes("黄金"));
  const totalRow = rows.find((r) => typeof r[0] === "string" && (r[0] as string).includes("合计"));
  if (!fxRow) throw new Error('SAFE reserves workbook: "Foreign currency reserves" row not found (layout may have changed)');
  if (!goldRow || !totalRow) throw new Error("SAFE reserves workbook: Gold/Total row not found (layout may have changed)");

  const points: MetricPoint[] = [];
  for (let month = 1; month <= 12; month++) {
    // Column layout is a fixed, stable USD/SDR pair per month (verified
    // directly): index 1 = Jan USD, index 2 = Jan SDR, index 3 = Feb USD, ...
    const colIndex = 2 * month - 1;
    const fx = parseAmount(fxRow[colIndex]);
    if (fx === null) continue; // month not yet published this year
    const observedAt = `${year}-${String(month).padStart(2, "0")}-01`;

    // Values are in 100-million-USD units (亿美元) -> convert to USD millions
    // to match this project's existing "liquidity.*" unit convention.
    points.push({
      metric_key: "china.fx_reserves_usd",
      observed_at: observedAt,
      value: Math.round(fx * 100 * 100) / 100,
      unit: "USD mm",
      source_key: "safe_gov_cn",
      source_tier: 1,
      frequency: "monthly",
    });

    const gold = parseAmount(goldRow[colIndex]);
    const total = parseAmount(totalRow[colIndex]);
    if (gold !== null && total !== null) {
      points.push({
        metric_key: "liquidity.china_reserves_ex_gold",
        observed_at: observedAt,
        value: Math.round((total - gold) * 100 * 100) / 100,
        unit: "USD mm",
        source_key: "safe_gov_cn",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  }
  return points;
}

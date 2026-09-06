import type { MetricPoint } from "../metrics/store";
import { fetchWorkbookSheet } from "./xlsWorkbook";

/**
 * ChinaBond (CCDC — China Central Depository & Clearing Co., the PBOC-designated
 * central securities depository for RMB bonds) publishes the "中债国债收益率曲线"
 * (ChinaBond Government Bond Yield Curve) — the standard benchmark cited
 * internationally as China's sovereign yield curve. No other free source
 * publishes a China government bond yield at all (checked FRED, OECD, BIS
 * during earlier work on this engine), so this was previously marked
 * UNAVAILABLE rather than guessed.
 *
 * CCDC's yield-curve chart page is JS-rendered, but it links to a genuine
 * structured data-export endpoint — an .xlsx per calendar year, every
 * standard tenor, no auth or session required — found by inspecting that
 * page's own "whole year download" link rather than by scraping rendered
 * content. `YC_DEF_ID` is CCDC's own stable identifier for this specific
 * curve ("中债国债收益率曲线(到期)"); fetching current year + prior 2 years
 * gives ~2.7 years of daily history in three requests.
 */
const YC_DEF_ID = "2c9081e50a2f9606010a3068cae70001";
const TARGET_TENOR_YEARS = 10;

async function fetchYear(year: number): Promise<{ date: string; value: number }[]> {
  const url = `https://yield.chinabond.com.cn/cbweb-mn/yc/downYearBzqx?year=${year}&&wrjxCBFlag=0&&zblx=txy&&ycDefId=${YC_DEF_ID}&&locale=zh_CN`;
  const rows = await fetchWorkbookSheet(url);

  const out: { date: string; value: number }[] = [];
  for (const row of rows.slice(1)) {
    const [dateRaw, , tenorYears, yieldRaw] = row as [unknown, unknown, unknown, unknown];
    if (Number(tenorYears) !== TARGET_TENOR_YEARS) continue;
    const m = String(dateRaw).match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) continue;
    const v = parseFloat(String(yieldRaw));
    if (Number.isNaN(v)) continue;
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, value: v });
  }
  return out;
}

export async function fetchChinaYield10y(): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const results = await Promise.allSettled([currentYear - 2, currentYear - 1, currentYear].map(fetchYear));

  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason));
      continue;
    }
    for (const row of r.value) {
      points.push({
        metric_key: "yield.china_10y",
        observed_at: row.date,
        value: row.value,
        unit: "%",
        source_key: "chinabond",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  if (points.length === 0) throw new Error(`ChinaBond 10Y: no data from any year (${errors.join("; ")})`);
  return points;
}

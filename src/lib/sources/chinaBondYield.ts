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

/**
 * ChinaBond also publishes a full corporate-bond yield curve, broken out by
 * credit rating (AAA down to CC) — same publisher, same daily cadence, same
 * download mechanism, found via the site's own curve-tree API
 * (/cbweb-mn/yc/queryTree, which returns every curve's name and internal
 * id — this is how AAA_YC_DEF_ID below was found, the same "inspect the
 * site's own data endpoint" method used for the government curve above).
 * AAA is the standard reference grade for a corporate-vs-government spread
 * in China's own market convention. Paired with the 10Y government yield
 * above (same source, same tenor, same day), this gives a genuine, free,
 * China-specific corporate credit spread — a real upgrade over the regional
 * "Asia-Pacific EM Corporate OAS" proxy credit.ts otherwise relies on for
 * China exposure, which is a broad multi-country regional index, not a
 * China-only signal.
 */
const AAA_YC_DEF_ID = "2c9081e50a2f9606010a309f4af50111";

async function fetchYearAtTenor(ycDefId: string, year: number, tenorYears: number): Promise<{ date: string; value: number }[]> {
  const url = `https://yield.chinabond.com.cn/cbweb-mn/yc/downYearBzqx?year=${year}&&wrjxCBFlag=0&&zblx=txy&&ycDefId=${ycDefId}&&locale=zh_CN`;
  const rows = await fetchWorkbookSheet(url);

  const out: { date: string; value: number }[] = [];
  for (const row of rows.slice(1)) {
    const [dateRaw, , rowTenorYears, yieldRaw] = row as [unknown, unknown, unknown, unknown];
    if (Number(rowTenorYears) !== tenorYears) continue;
    const m = String(dateRaw).match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) continue;
    const v = parseFloat(String(yieldRaw));
    if (Number.isNaN(v)) continue;
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, value: v });
  }
  return out;
}

async function fetchChinaBondCurve(ycDefId: string, metricKey: string): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const results = await Promise.allSettled(
    [currentYear - 2, currentYear - 1, currentYear].map((y) => fetchYearAtTenor(ycDefId, y, TARGET_TENOR_YEARS))
  );

  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason));
      continue;
    }
    for (const row of r.value) {
      points.push({
        metric_key: metricKey,
        observed_at: row.date,
        value: row.value,
        unit: "%",
        source_key: "chinabond",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  if (points.length === 0) throw new Error(`ChinaBond ${metricKey}: no data from any year (${errors.join("; ")})`);
  return points;
}

export async function fetchChinaYield10y(): Promise<MetricPoint[]> {
  return fetchChinaBondCurve(YC_DEF_ID, "yield.china_10y");
}

/** ChinaBond Corporate Bond Yield Curve (AAA), 10Y tenor — see AAA_YC_DEF_ID docs above. */
export async function fetchChinaCorpAaaYield10y(): Promise<MetricPoint[]> {
  return fetchChinaBondCurve(AAA_YC_DEF_ID, "credit.china_corp_aaa_10y");
}

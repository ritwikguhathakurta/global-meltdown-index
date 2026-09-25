import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * Shanghai Stock Exchange (SSE) ETF options daily statistics — the JSON data API that the
 * exchange's own options page (sse.com.cn/assortment/options/date/) reads, free and keyless:
 *
 *   https://query.sse.com.cn/commonQuery.do?sqlId=COMMON_SSE_ZQPZ_YSP_QQ_SJTJ_MRTJ_CX&tradeDate=<yyyymmdd>
 *
 * The API expects a Referer of https://www.sse.com.cn/ (as any browser page load sends it); no
 * cookies, keys, or challenge are involved.
 *
 * Verified live (2026-09-25, trading day 2026-09-24): one row per ETF underlying (SSE 50,
 * CSI 300, CSI 500, STAR 50 x2) with real outstanding open interest split into calls
 * (LEAVES_CALL_QTY) and puts (LEAVES_PUT_QTY), plus call/put traded volume. Summed into a
 * whole-market open-interest put/call ratio and a volume put/call ratio, analogous to
 * hkexDerivatives.ts / taifexDerivatives.ts / cffexDerivatives.ts. Values are formatted with
 * thousands separators ("976,833") and are parsed accordingly.
 */
const URL_BASE = "https://query.sse.com.cn/commonQuery.do?sqlId=COMMON_SSE_ZQPZ_YSP_QQ_SJTJ_MRTJ_CX";
const HEADERS = {
  Referer: "https://www.sse.com.cn/",
  "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)",
};

type Row = {
  TRADE_DATE: string;
  LEAVES_CALL_QTY: string;
  LEAVES_PUT_QTY: string;
  CALL_VOLUME: string;
  PUT_VOLUME: string;
};

const n = (v: string | undefined) => {
  const x = parseFloat((v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

async function fetchLatestDay(maxLookbackDays = 8): Promise<Row[] | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const res = await fetchRetry(`${URL_BASE}&tradeDate=${ymd}`, { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) continue;
    const rows = ((await res.json()) as { result?: Row[] }).result ?? [];
    if (rows.length > 0) return rows;
  }
  return null;
}

export async function fetchSseOptions(): Promise<MetricPoint[]> {
  const rows = await fetchLatestDay();
  if (!rows) throw new Error("SSE options: no daily data found in the last 8 days");
  const observed_at = rows[0].TRADE_DATE;
  const call = rows.reduce((s, r) => s + n(r.LEAVES_CALL_QTY), 0);
  const put = rows.reduce((s, r) => s + n(r.LEAVES_PUT_QTY), 0);
  const callVol = rows.reduce((s, r) => s + n(r.CALL_VOLUME), 0);
  const putVol = rows.reduce((s, r) => s + n(r.PUT_VOLUME), 0);
  if (call <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(observed_at)) throw new Error("SSE options: unusable rows");
  const base = { observed_at, source_key: "sse_options", source_tier: 1 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [
    { ...base, metric_key: "derivatives.sse.options.call_oi", value: call, unit: "contracts" },
    { ...base, metric_key: "derivatives.sse.options.put_oi", value: put, unit: "contracts" },
    { ...base, metric_key: "derivatives.sse.options.pcr_oi", value: put / call, unit: "ratio" },
  ];
  if (callVol > 0) points.push({ ...base, metric_key: "derivatives.sse.options.pcr_volume", value: putVol / callVol, unit: "ratio" });
  return points;
}

import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * Shenzhen Stock Exchange (SZSE) ETF options daily overview — the exchange's own public report
 * API behind szse.cn/market/option/day (catalog id `ysprdzb`), free and keyless:
 *
 *   https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=ysprdzb&txtQueryDate=<yyyy-mm-dd>
 *
 * Verified live (2026-09-25, trading day 2026-09-24): one row per ETF underlying (CSI 300,
 * CSI 500, ChiNext, SZSE 100) with real outstanding open interest split into call contracts
 * (`wpcrchys`) and put contracts (`wpcrphys`), plus call/put traded volume (`rccjl`/`rpcjl`).
 * Summed into a whole-market OI put/call ratio and a volume put/call ratio, the Shenzhen
 * counterpart to sseOptions.ts. Numbers are formatted with thousands separators.
 */
const URL_BASE = "https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=ysprdzb";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

type Row = { wpcrchys: string; wpcrphys: string; rccjl: string; rpcjl: string };

const n = (v: string | undefined) => {
  const x = parseFloat((v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

async function fetchLatestDay(maxLookbackDays = 8): Promise<{ rows: Row[]; date: string } | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const res = await fetchRetry(`${URL_BASE}&txtQueryDate=${date}`, { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) continue;
    const rows = ((await res.json()) as { data?: Row[] }[])[0]?.data ?? [];
    if (rows.length > 0) return { rows, date };
  }
  return null;
}

export async function fetchSzseOptions(): Promise<MetricPoint[]> {
  const day = await fetchLatestDay();
  if (!day) throw new Error("SZSE options: no daily data found in the last 8 days");
  const call = day.rows.reduce((s, r) => s + n(r.wpcrchys), 0);
  const put = day.rows.reduce((s, r) => s + n(r.wpcrphys), 0);
  const callVol = day.rows.reduce((s, r) => s + n(r.rccjl), 0);
  const putVol = day.rows.reduce((s, r) => s + n(r.rpcjl), 0);
  if (call <= 0) throw new Error("SZSE options: unusable rows");
  const base = { observed_at: day.date, source_key: "szse_options", source_tier: 1 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [
    { ...base, metric_key: "derivatives.szse.options.call_oi", value: call, unit: "contracts" },
    { ...base, metric_key: "derivatives.szse.options.put_oi", value: put, unit: "contracts" },
    { ...base, metric_key: "derivatives.szse.options.pcr_oi", value: put / call, unit: "ratio" },
  ];
  if (callVol > 0) points.push({ ...base, metric_key: "derivatives.szse.options.pcr_volume", value: putVol / callVol, unit: "ratio" });
  return points;
}

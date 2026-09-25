import type { MetricPoint } from "../metrics/store";

/**
 * TAIFEX (Taiwan Futures Exchange) official Open API — free, no key, no login:
 *
 *   https://openapi.taifex.com.tw/v1/DailyMarketReportFut   (futures, all contracts)
 *   https://openapi.taifex.com.tw/v1/DailyMarketReportOpt   (options, all contracts)
 *
 * Found while evaluating screenshot extraction for the daily market report
 * page (2026-09-25): the same numbers the page renders are published as JSON,
 * so no page reading is needed and every value stays deterministic.
 *
 * Futures: TX (TAIEX index futures) open interest summed across every listed
 * expiry, regular ("一般") session only — the after-hours session reports "-"
 * for OI, and calendar-spread rows (contract month "A/B") are excluded so
 * nothing is double-counted.
 *
 * Options: TXO (TAIEX options) whole-market put ("賣權") / call ("買權") open
 * interest, regular session, analogous to NSE India's and HKEX's put/call OI
 * ratio (see nseFoBhavcopy.ts, hkexDerivatives.ts).
 */

const BASE = "https://openapi.taifex.com.tw/v1";
const REGULAR_SESSION = "一般";
const CALL = "買權";
const PUT = "賣權";

type FutRow = { Date: string; Contract: string; "ContractMonth(Week)": string; OpenInterest: string; TradingSession: string };
type OptRow = { Date: string; Contract: string; CallPut: string; OpenInterest: string; TradingSession: string };

async function getJson<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`TAIFEX ${path}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

function isoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function oi(v: string): number | null {
  const n = parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function fetchTaifexDerivatives(): Promise<MetricPoint[]> {
  const points: MetricPoint[] = [];
  const base = { source_key: "taifex_derivatives", source_tier: 1 as const, frequency: "daily" as const };

  const fut = await getJson<FutRow>("DailyMarketReportFut");
  const tx = fut.filter((r) => r.Contract === "TX" && r.TradingSession === REGULAR_SESSION && !r["ContractMonth(Week)"].includes("/"));
  let txOi = 0;
  for (const r of tx) txOi += oi(r.OpenInterest) ?? 0;
  if (tx.length > 0 && txOi > 0) {
    points.push({ ...base, metric_key: "derivatives.taifex.tx_futures.oi", observed_at: isoDate(tx[0].Date), value: txOi, unit: "contracts" });
  }

  const opt = await getJson<OptRow>("DailyMarketReportOpt");
  const txo = opt.filter((r) => r.Contract === "TXO" && r.TradingSession === REGULAR_SESSION);
  let call = 0;
  let put = 0;
  for (const r of txo) {
    const v = oi(r.OpenInterest);
    if (v === null) continue;
    if (r.CallPut === CALL) call += v;
    else if (r.CallPut === PUT) put += v;
  }
  if (txo.length > 0 && call > 0) {
    const observed_at = isoDate(txo[0].Date);
    points.push({ ...base, metric_key: "derivatives.taifex.txo.call_oi", observed_at, value: call, unit: "contracts" });
    points.push({ ...base, metric_key: "derivatives.taifex.txo.put_oi", observed_at, value: put, unit: "contracts" });
    points.push({ ...base, metric_key: "derivatives.taifex.txo.pcr_oi", observed_at, value: put / call, unit: "ratio" });
  }

  if (points.length === 0) throw new Error("TAIFEX: no usable rows in DailyMarketReportFut/Opt");
  return points;
}

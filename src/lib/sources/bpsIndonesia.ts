import type { MetricPoint } from "../metrics/store";

/**
 * Indonesia — BPS (Badan Pusat Statistik) dynamic Web API. Requires a free
 * registered API key (BPS_API_KEY) — see https://webapi.bps.go.id/developer.
 * Unauthenticated requests, and requests without a browser-like User-Agent,
 * are blocked by BPS's own WAF (verified live: an identical request succeeds
 * once a User-Agent header is added — this is a WAF quirk, not an auth
 * problem, and the key itself works).
 *
 * Table map (found live via model=subject -> model=var -> model=vervar /
 * model=turvar before use, not guessed):
 *   - var=132 "Produksi Tanaman Perkebunan" (all ownership: large estate +
 *     smallholder combined), vervar=9999 (INDONESIA national total),
 *     turvar=252 (Kelapa Sawit / oil palm) and turvar=253 (Kelapa /
 *     coconut). Annual, "Ribu Ton" (thousand MT). The turvar=252 figures
 *     (~46.8-47.1 million MT for 2022-2023) match published Indonesian CPO
 *     output almost exactly, confirming this is CPO production, not raw
 *     fresh-fruit-bunch tonnage. Verified live year-by-year: "available"
 *     from 2009 onward, "list-not-available" for 2003-2008 — that boundary
 *     isn't hardcoded below, out-of-range years are simply skipped via the
 *     per-year data-availability check.
 *   - var=761 "Produksi Perkebunan Besar Bulanan Menurut Jenis Tanaman" —
 *     LARGE ESTATES ONLY (not the full national figure), vervar=2 (Kelapa
 *     Sawit). Monthly, "Ribu Ton". This is the only higher-than-annual
 *     frequency BPS publishes for palm, so it's kept as its own explicitly
 *     large-estate-scoped metric rather than blended with the national
 *     total above. Also verified live back to 2009 (same boundary as the
 *     annual series above).
 *   - Soybean/groundnut (var=23, "Produksi Tanaman Pangan") checked and NOT
 *     built: that table's dynamic series stops at 2015 (BPS's own notes cite
 *     a 2016-17 methodology moratorium with continuation tables published
 *     for Padi/Jagung only — checked both pages of the "Tanaman Pangan"
 *     subject's variable list, no post-2018 soybean/groundnut var exists).
 *
 * BPS caps the `th` (year) range parameter at 3 years per request, so annual
 * series are fetched one year at a time here — which also sidesteps any
 * ambiguity in decoding the response's opaque datacontent keys, since a
 * single-year, single-turvar, single-vervar annual request returns exactly
 * one value with nothing to decode.
 *
 * The monthly endpoint has no such single-value shortcut: passing a
 * `turtahun` (month) filter in the URL is silently ignored, so one request
 * per year returns every available month keyed by an undocumented composite
 * id (e.g. "276101241" for Jan 2024). Verified live that within one
 * response every key shares an identical leading substring and the
 * remainder is the bare turtahun (month) number with no padding — confirmed
 * by checking that turtahun=13 ("Tahunan") decodes to a value equal to the
 * exact sum of that year's 12 monthly values. Decoded below via the longest
 * common prefix across that response's own keys (data-derived), not a
 * hardcoded numeric offset.
 */

const BPS_BASE = "https://webapi.bps.go.id/v1/api/list/model/data/domain/0000";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

type BpsDataResponse = {
  status: string;
  "data-availability": string;
  datacontent?: Record<string, number>;
};

async function bpsFetch(apiKey: string, params: string): Promise<BpsDataResponse> {
  const url = `${BPS_BASE}/${params}/key/${apiKey}/`;
  const init = { headers: { "User-Agent": UA }, next: { revalidate: 0 } };
  // BPS intermittently drops the connection ("fetch failed", roughly every other run in
  // production) — a network error, not a bad response — so retry once before giving up.
  const res = await fetch(url, init).catch(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    return fetch(url, init);
  });
  if (!res.ok) throw new Error(`BPS Indonesia: HTTP ${res.status}`);
  return (await res.json()) as BpsDataResponse;
}

function longestCommonPrefixLength(keys: string[]): number {
  if (keys.length === 0) return 0;
  let prefix = keys[0];
  for (const k of keys.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < k.length && prefix[i] === k[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix.length === 0) break;
  }
  return prefix.length;
}

function thId(year: number): number {
  return year - 1900;
}

async function fetchAnnualNationalTotal(apiKey: string, turvar: number, years: number[]): Promise<{ year: number; value: number }[]> {
  const out: { year: number; value: number }[] = [];
  for (const year of years) {
    const resp = await bpsFetch(apiKey, `var/132/vervar/9999/turvar/${turvar}/th/${thId(year)}`);
    if (resp["data-availability"] !== "available" || !resp.datacontent) continue;
    const values = Object.values(resp.datacontent);
    if (values.length !== 1) continue; // ambiguous/unexpected shape for a single-year annual query — skip rather than guess
    out.push({ year, value: values[0] });
  }
  return out;
}

async function fetchMonthlyLargeEstate(apiKey: string, years: number[]): Promise<{ year: number; month: number; value: number }[]> {
  const out: { year: number; month: number; value: number }[] = [];
  for (const year of years) {
    const resp = await bpsFetch(apiKey, `var/761/vervar/2/th/${thId(year)}`);
    if (resp["data-availability"] !== "available" || !resp.datacontent) continue;
    const entries = Object.entries(resp.datacontent);
    if (entries.length < 2) continue; // can't decode a single opaque key via common-prefix — skip rather than guess
    const prefixLen = longestCommonPrefixLength(entries.map(([k]) => k));
    for (const [key, value] of entries) {
      const turtahun = parseInt(key.slice(prefixLen), 10);
      if (Number.isNaN(turtahun) || turtahun < 1 || turtahun > 12) continue; // 13 = "Tahunan" annual total, not a month
      out.push({ year, month: turtahun, value });
    }
  }
  return out;
}

export async function fetchBpsIndonesiaBalances(apiKey: string): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  // Both series are verified available back to 2009 (see comment above) — 20
  // years comfortably covers that full span; requests for years before 2009
  // come back "list-not-available" and are skipped, not guessed.
  const annualYears = Array.from({ length: 20 }, (_, i) => currentYear - i);
  const monthlyYears = Array.from({ length: 20 }, (_, i) => currentYear - i);

  const [oilPalmAnnual, coconutAnnual, oilPalmMonthly] = await Promise.all([
    fetchAnnualNationalTotal(apiKey, 252, annualYears),
    fetchAnnualNationalTotal(apiKey, 253, annualYears),
    fetchMonthlyLargeEstate(apiKey, monthlyYears),
  ]);

  const points: MetricPoint[] = [];
  for (const { year, value } of oilPalmAnnual) {
    points.push({
      metric_key: "commodity.palm_oil.indonesia.production",
      observed_at: `${year}-12-31`,
      value: value / 1000,
      unit: "million MT",
      source_key: "bps_indonesia",
      source_tier: 1,
      frequency: "annual",
    });
  }
  for (const { year, value } of coconutAnnual) {
    points.push({
      metric_key: "commodity.coconut.indonesia.production",
      observed_at: `${year}-12-31`,
      value: value / 1000,
      unit: "million MT",
      source_key: "bps_indonesia",
      source_tier: 1,
      frequency: "annual",
    });
  }
  for (const { year, month, value } of oilPalmMonthly) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    points.push({
      metric_key: "commodity.palm_oil.indonesia.production_monthly_large_estate",
      observed_at: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      value: value / 1000,
      unit: "million MT",
      source_key: "bps_indonesia",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  return points;
}

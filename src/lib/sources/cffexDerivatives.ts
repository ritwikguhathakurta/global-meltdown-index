import type { MetricPoint } from "../metrics/store";

/**
 * CFFEX (China Financial Futures Exchange) official daily data — free, no
 * key, no login, one XML file per trading day:
 *
 *   http://www.cffex.com.cn/sj/hqsj/rtj/<yyyymm>/<dd>/index.xml
 *
 * (plain http: the https endpoint times out from this environment.)
 *
 * Verified live (2026-09-25, trading day 2026-09-24): 658 per-instrument rows
 * with real `openinterest` straight from the exchange.
 *
 * Index futures: IF (CSI 300), IH (SSE 50), IC (CSI 500), IM (CSI 1000) —
 * open interest summed across every listed expiry.
 * Index options: IO (CSI 300), HO (SSE 50), MO (CSI 1000) — instrument ids
 * look like `HO2610-C-2500` / `HO2610-P-2500`; call and put OI are summed
 * across every option product into a whole-market put/call OI ratio,
 * analogous to hkexDerivatives.ts / taifexDerivatives.ts.
 * Government-bond futures: T, TF, TS, TL open interest summed per product.
 */

const BASE = "http://www.cffex.com.cn/sj/hqsj/rtj";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

const INDEX_FUTURES = [
  { id: "IF", slug: "if_csi300" },
  { id: "IH", slug: "ih_sse50" },
  { id: "IC", slug: "ic_csi500" },
  { id: "IM", slug: "im_csi1000" },
];
const BOND_FUTURES = ["T", "TF", "TS", "TL"];

type Row = Record<string, string>;

function parseRows(xml: string): Row[] {
  const rows: Row[] = [];
  for (const m of xml.matchAll(/<dailydata>([\s\S]*?)<\/dailydata>/g)) {
    const row: Row = {};
    for (const f of m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) row[f[1]] = f[2].trim();
    rows.push(row);
  }
  return rows;
}

async function fetchLatestDay(maxLookbackDays = 8): Promise<Row[] | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const res = await fetch(`${BASE}/${yyyy}${mm}/${dd}/index.xml`, { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) continue;
    const rows = parseRows(await res.text());
    if (rows.length > 0) return rows;
  }
  return null;
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

function isoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export async function fetchCffexDerivatives(): Promise<MetricPoint[]> {
  const rows = await fetchLatestDay();
  if (!rows) throw new Error("CFFEX: no daily data found in the last 8 days");
  const observed_at = isoDate(rows[0].tradingday);
  const base = { observed_at, source_key: "cffex_derivatives", source_tier: 1 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [];

  const sumOi = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((s, r) => s + num(r.openinterest), 0);

  for (const { id, slug } of INDEX_FUTURES) {
    const re = new RegExp(`^${id}\\d{4}$`);
    const oi = sumOi((r) => re.test(r.instrumentid));
    if (oi > 0) points.push({ ...base, metric_key: `derivatives.cffex.${slug}_futures.oi`, value: oi, unit: "contracts" });
  }

  for (const id of BOND_FUTURES) {
    const re = new RegExp(`^${id}\\d{4}$`);
    const oi = sumOi((r) => re.test(r.instrumentid));
    if (oi > 0) points.push({ ...base, metric_key: `derivatives.cffex.${id.toLowerCase()}_bond_futures.oi`, value: oi, unit: "contracts" });
  }

  const callOi = sumOi((r) => /^(IO|HO|MO)\d{4}-C-/.test(r.instrumentid));
  const putOi = sumOi((r) => /^(IO|HO|MO)\d{4}-P-/.test(r.instrumentid));
  if (callOi > 0) {
    points.push({ ...base, metric_key: "derivatives.cffex.options.call_oi", value: callOi, unit: "contracts" });
    points.push({ ...base, metric_key: "derivatives.cffex.options.put_oi", value: putOi, unit: "contracts" });
    points.push({ ...base, metric_key: "derivatives.cffex.options.pcr_oi", value: putOi / callOi, unit: "ratio" });
  }

  if (points.length === 0) throw new Error("CFFEX: no usable open-interest rows");
  return points;
}

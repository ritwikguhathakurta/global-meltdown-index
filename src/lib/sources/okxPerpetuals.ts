import type { MetricPoint } from "../metrics/store";

/**
 * OKX public market-data API (www.okx.com/api/v5/public) — free, no key or login. Replaces
 * Binance USD-M Futures for this metric: Binance's fapi returns HTTP 451 ("unavailable for
 * legal reasons") to US-based servers, which is where this pipeline runs, so it never
 * produced data in production. OKX's public market-data endpoints are served to that
 * region. Same coverage: BTC/ETH USDT-margined perpetual swap funding rate and open interest —
 * a single commercial exchange, not a regulator or cross-exchange aggregate, so Tier 3 and
 * labeled as such wherever it's shown. Metric keys are unchanged from the Binance version.
 *
 * Open interest is `oiCcy` (in BTC/ETH, matching Binance's unit), not `oi` (contract count).
 */
const BASE_URL = "https://www.okx.com/api/v5/public";

const SYMBOLS: { instId: string; metricSlug: string }[] = [
  { instId: "BTC-USDT-SWAP", metricSlug: "btc" },
  { instId: "ETH-USDT-SWAP", metricSlug: "eth" },
];

const failures: string[] = [];

async function fetchOne(instId: string): Promise<{ fundingRate: number; openInterest: number } | null> {
  const [fundingRes, oiRes] = await Promise.all([
    fetch(`${BASE_URL}/funding-rate?instId=${instId}`, { next: { revalidate: 0 } }),
    fetch(`${BASE_URL}/open-interest?instType=SWAP&instId=${instId}`, { next: { revalidate: 0 } }),
  ]);
  if (!fundingRes.ok || !oiRes.ok) {
    failures.push(`${instId}: HTTP ${fundingRes.status}/${oiRes.status}`);
    return null;
  }
  const funding = (await fundingRes.json()) as { data?: { fundingRate?: string }[] };
  const oi = (await oiRes.json()) as { data?: { oiCcy?: string }[] };
  const fundingRate = parseFloat(funding.data?.[0]?.fundingRate ?? "");
  const openInterest = parseFloat(oi.data?.[0]?.oiCcy ?? "");
  if (Number.isNaN(fundingRate) || Number.isNaN(openInterest)) {
    failures.push(`${instId}: unparseable response`);
    return null;
  }
  return { fundingRate, openInterest };
}

export async function fetchOkxPerpetuals(): Promise<MetricPoint[]> {
  const now = new Date().toISOString().slice(0, 10);
  const points: MetricPoint[] = [];
  failures.length = 0;
  for (const s of SYMBOLS) {
    const data = await fetchOne(s.instId);
    if (!data) continue;
    points.push({
      metric_key: `derivatives.crypto_perp.${s.metricSlug}.funding_rate`,
      observed_at: now,
      value: data.fundingRate,
      unit: "fraction per 8h",
      source_key: "okx_perp",
      source_tier: 3,
      frequency: "daily",
    });
    points.push({
      metric_key: `derivatives.crypto_perp.${s.metricSlug}.open_interest`,
      observed_at: now,
      value: data.openInterest,
      unit: "contracts",
      source_key: "okx_perp",
      source_tier: 3,
      frequency: "daily",
    });
  }
  if (points.length === 0) throw new Error(`OKX perpetuals: no symbols returned data (${failures.join("; ") || "no HTTP error recorded"})`);
  return points;
}

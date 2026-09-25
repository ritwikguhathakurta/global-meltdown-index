import type { MetricPoint } from "../metrics/store";

/**
 * Binance USD-M Futures public API (fapi.binance.com) — verified live, no auth/key required for
 * market data (BINANCE_API_KEY in this project's env is not needed here and isn't sent). Covers
 * spec §66 "Crypto Derivatives: funding rates, open interest, leverage" to the extent free data
 * allows: a single commercial exchange's BTC/ETH perpetual swaps, not a cross-exchange aggregate
 * or a regulator-published figure — explicitly Tier 3 and labeled as such everywhere it's shown,
 * the same tiering this repo already gives coingecko.ts and massiveFutures.ts. A persistently
 * positive/negative funding rate is the real-world signal of one-sided perpetual leverage (longs
 * paying shorts, or vice versa) that spec §69/74 asks for; open interest is the raw exposure size.
 */
const BASE_URL = "https://fapi.binance.com/fapi/v1";

const SYMBOLS: { symbol: string; metricSlug: string; label: string }[] = [
  { symbol: "BTCUSDT", metricSlug: "btc", label: "Bitcoin perpetual" },
  { symbol: "ETHUSDT", metricSlug: "eth", label: "Ethereum perpetual" },
];

const failures: string[] = [];

async function fetchOne(symbol: string): Promise<{ fundingRate: number; openInterest: number } | null> {
  const [premiumRes, oiRes] = await Promise.all([
    fetch(`${BASE_URL}/premiumIndex?symbol=${symbol}`, { next: { revalidate: 0 } }),
    fetch(`${BASE_URL}/openInterest?symbol=${symbol}`, { next: { revalidate: 0 } }),
  ]);
  if (!premiumRes.ok || !oiRes.ok) {
    failures.push(`${symbol}: HTTP ${premiumRes.status}/${oiRes.status}`);
    return null;
  }
  const premium = (await premiumRes.json()) as { lastFundingRate?: string };
  const oi = (await oiRes.json()) as { openInterest?: string };
  const fundingRate = premium.lastFundingRate !== undefined ? parseFloat(premium.lastFundingRate) : NaN;
  const openInterest = oi.openInterest !== undefined ? parseFloat(oi.openInterest) : NaN;
  if (Number.isNaN(fundingRate) || Number.isNaN(openInterest)) return null;
  return { fundingRate, openInterest };
}

export async function fetchBinancePerpetuals(): Promise<MetricPoint[]> {
  const now = new Date().toISOString().slice(0, 10);
  const points: MetricPoint[] = [];
  failures.length = 0;
  for (const s of SYMBOLS) {
    const data = await fetchOne(s.symbol);
    if (!data) continue;
    points.push({
      metric_key: `derivatives.crypto_perp.${s.metricSlug}.funding_rate`,
      observed_at: now,
      value: data.fundingRate,
      unit: "fraction per 8h",
      source_key: "binance_perp",
      source_tier: 3,
      frequency: "daily",
    });
    points.push({
      metric_key: `derivatives.crypto_perp.${s.metricSlug}.open_interest`,
      observed_at: now,
      value: data.openInterest,
      unit: "contracts",
      source_key: "binance_perp",
      source_tier: 3,
      frequency: "daily",
    });
  }
  if (points.length === 0) throw new Error(`Binance perpetuals: no symbols returned data (${failures.join("; ") || "no HTTP error recorded"})`);
  return points;
}

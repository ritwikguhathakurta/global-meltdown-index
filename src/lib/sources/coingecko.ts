import type { MetricPoint } from "../metrics/store";

/**
 * CoinGecko public API — free, no key required, Tier 3 (licensed/unofficial
 * aggregator; there is no Tier-1 official source for crypto market data).
 * Only current snapshot is available on the free tier (no free historical
 * backfill), so each pipeline run appends one point per metric per day —
 * the trailing series still builds up for z-scoring over time.
 */
export async function fetchCryptoSnapshot(observedAtIso: string): Promise<MetricPoint[]> {
  const [globalRes, priceRes] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/global", { next: { revalidate: 0 } }),
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin&vs_currencies=usd&include_market_cap=true",
      { next: { revalidate: 0 } }
    ),
  ]);
  if (!globalRes.ok) throw new Error(`CoinGecko /global: HTTP ${globalRes.status}`);
  if (!priceRes.ok) throw new Error(`CoinGecko /simple/price: HTTP ${priceRes.status}`);

  const global = (await globalRes.json()) as {
    data?: { total_market_cap?: { usd?: number }; market_cap_percentage?: { btc?: number } };
  };
  const prices = (await priceRes.json()) as Record<string, { usd?: number; usd_market_cap?: number }>;

  const points: MetricPoint[] = [];
  const push = (metricKey: string, value: number | undefined, unit: string) => {
    if (value === undefined || Number.isNaN(value)) return;
    points.push({
      metric_key: metricKey,
      observed_at: observedAtIso,
      value,
      unit,
      source_key: "coingecko",
      source_tier: 3,
      frequency: "daily",
    });
  };

  push("crypto.total_market_cap_usd", global.data?.total_market_cap?.usd, "USD");
  push("crypto.btc_dominance_pct", global.data?.market_cap_percentage?.btc, "%");
  push("crypto.btc_price_usd", prices.bitcoin?.usd, "USD");
  push("crypto.eth_price_usd", prices.ethereum?.usd, "USD");

  const usdtCap = prices.tether?.usd_market_cap;
  const usdcCap = prices["usd-coin"]?.usd_market_cap;
  push("crypto.stablecoin_supply_usdt", usdtCap, "USD");
  push("crypto.stablecoin_supply_usdc", usdcCap, "USD");
  const usdtPeg = prices.tether?.usd;
  const usdcPeg = prices["usd-coin"]?.usd;
  if (usdtPeg !== undefined) push("crypto.usdt_peg_deviation_bps", Math.abs(usdtPeg - 1) * 10000, "bps");
  if (usdcPeg !== undefined) push("crypto.usdc_peg_deviation_bps", Math.abs(usdcPeg - 1) * 10000, "bps");

  return points;
}

-- okx_perp — OKX public market-data API: BTC/ETH perpetual funding rate and open interest.
--   Tier 3 (single commercial exchange). Replaces binance_perp, which Binance geo-blocks
--   (HTTP 451) from the US-based servers this pipeline runs on. See src/lib/sources/okxPerpetuals.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('okx_perp', 'OKX Perpetual Swaps (public API)', 'OKX', 'https://www.okx.com', 3, 'derivatives', 'active')
on conflict (key) do nothing;

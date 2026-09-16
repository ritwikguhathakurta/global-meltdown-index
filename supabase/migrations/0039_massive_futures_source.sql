-- ============================================================================
-- Massive (massive.com) — paid financial market-data API. Tier 3 (commercial
-- market data, same tier as yahoo_finance), not Tier 1: this is a licensed
-- redistributor of CME/CBOT/NYMEX/COMEX futures data, not the primary
-- official source itself. Feeds delayed-but-real daily futures settlement
-- prices for Grains/Oilseeds Short-Term momentum and the Chemicals overview's
-- upstream feedstock reference prices — see src/lib/sources/massiveFutures.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('massive_futures', 'Massive Futures API', 'Massive', 'https://massive.com', 3, 'market_data', 'active')
on conflict (key) do nothing;

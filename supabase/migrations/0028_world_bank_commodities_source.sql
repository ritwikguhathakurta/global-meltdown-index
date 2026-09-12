-- ============================================================================
-- World Bank Commodity Price Data ("The Pink Sheet") — free, no key, no
-- login. Monthly nominal-USD commodity prices since 1960, updated monthly.
-- Feeds the new Commodities engine (Phase 1) — see
-- src/lib/sources/worldBankCommodities.ts and src/lib/engines/commodities.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('world_bank_commodities', 'World Bank Commodity Price Data (Pink Sheet)', 'World Bank', 'https://www.worldbank.org/en/research/commodity-markets', 1, 'commodities', 'active')
on conflict (key) do nothing;

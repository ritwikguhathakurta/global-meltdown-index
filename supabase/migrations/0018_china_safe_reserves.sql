-- ============================================================================
-- Global Liquidity engine — fixes the previously-empty "Balance Sheet"
-- column on the PBOC (China) row: SAFE (State Administration of Foreign
-- Exchange) publishes China's monthly Official Reserve Assets, a genuine
-- balance-sheet-side quantity for China (Total minus Gold matches FRED's own
-- "Total Reserves excluding Gold for China" series definition exactly, and
-- is fresher — ~1-month lag vs FRED's ~2-3 month lag on the same underlying
-- IMF data). See src/lib/sources/chinaFxReserves.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('safe_gov_cn', 'Official Reserve Assets', 'State Administration of Foreign Exchange (China)', 'https://www.safe.gov.cn/en/', 1, 'global_liquidity', 'active')
on conflict (key) do nothing;

-- ============================================================================
-- USDA FAS Production, Supply and Distribution (PSD) bulk data — free, no
-- key, no login. Annual world commodity production/consumption/ending-
-- stocks balances. See src/lib/sources/usdaPsd.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('usda_psd', 'USDA FAS Production, Supply and Distribution (PSD)', 'USDA Foreign Agricultural Service', 'https://apps.fas.usda.gov/psdonline/app/index.html', 1, 'commodities', 'active')
on conflict (key) do nothing;

-- ============================================================================
-- UN Comtrade — free, no key, no login "data preview" API for official
-- bilateral trade statistics (crude oil HS 2709, petroleum gases HS 2711).
-- Feeds the Global Energy Trade Network Graph — see
-- src/lib/sources/unComtrade.ts and src/lib/engines/energyTradeNetwork.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('un_comtrade', 'UN Comtrade', 'United Nations Statistics Division', 'https://comtradeapi.un.org', 1, 'energy', 'active')
on conflict (key) do nothing;

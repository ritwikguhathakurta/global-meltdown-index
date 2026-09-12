-- ============================================================================
-- IRENA IRENASTAT — free, no key, no login, official PxWeb statistical API
-- for renewable/non-renewable electricity capacity and generation by
-- country. Feeds the Country Energy Balance / Transition Risk view — see
-- src/lib/sources/irenaStat.ts and src/lib/engines/energyCountryBalance.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('irena_irenastat', 'IRENA IRENASTAT', 'International Renewable Energy Agency', 'https://pxweb.irena.org', 1, 'energy', 'active')
on conflict (key) do nothing;

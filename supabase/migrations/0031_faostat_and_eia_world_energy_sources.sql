-- ============================================================================
-- FAOSTAT bulk production data and the EIA international dataset's own
-- "World" region aggregate — both free, no key beyond the standard
-- EIA_API_KEY this app already uses. See src/lib/sources/faostat.ts and
-- src/lib/sources/eiaWorldEnergy.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('faostat', 'FAOSTAT Production, Crops and Livestock', 'UN Food and Agriculture Organization', 'https://www.fao.org/faostat/en/#data/QCL', 1, 'commodities', 'active'),
  ('eia_world_energy', 'EIA International Energy Statistics (World aggregate)', 'U.S. Energy Information Administration', 'https://www.eia.gov/international/data/world', 1, 'commodities', 'active')
on conflict (key) do nothing;

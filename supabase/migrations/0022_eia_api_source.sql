-- ============================================================================
-- EIA API v2 — free (registered key), Tier 1 official US government source.
-- Feeds the Energy Systemic Risk engine: country-level petroleum production/
-- consumption (Country Energy Balance Engine, spec §6/10) and US natural gas
-- working storage (closes a previously-disclosed gap) — see
-- src/lib/sources/eiaApi.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('eia_api', 'EIA Open Data API v2', 'US Energy Information Administration', 'https://www.eia.gov/opendata/', 1, 'energy', 'active')
on conflict (key) do nothing;

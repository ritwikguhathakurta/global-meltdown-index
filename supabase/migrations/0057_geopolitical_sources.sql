-- ============================================================================
-- New source connectors for the Geopolitical Intelligence rebuild
-- (src/app/dashboard/geopolitical). See docs/GEOPOLITICAL_ENGINE.md.
--
-- gdelt_events — GDELT 2.0 Event Database bulk export files (CAMEO event
--   codes, Goldstein scale), free, no key. Tier 2 (automated news-text
--   event-coding, not verified intelligence).
-- sipri_milex — SIPRI Military Expenditure Database, official, free, annual
--   since 1949. Tier 1.
-- world_bank — already registered elsewhere in this project; re-inserted
--   here with `on conflict do nothing` in case this migration runs before
--   any prior World Bank connector's migration.
-- ofac_sdn — US Treasury OFAC Specially Designated Nationals list, official,
--   free. Tier 1.
-- ucdp_ged — Uppsala Conflict Data Program Georeferenced Event Dataset,
--   official, free (registration required for an API token). Tier 1.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('gdelt_events', 'GDELT 2.0 Event Database', 'GDELT Project', 'https://www.gdeltproject.org', 2, 'geopolitical', 'active'),
  ('sipri_milex', 'SIPRI Military Expenditure Database', 'Stockholm International Peace Research Institute', 'https://www.sipri.org', 1, 'geopolitical', 'active'),
  ('world_bank', 'World Bank Open Data', 'World Bank', 'https://data.worldbank.org', 1, 'macro', 'active'),
  ('ofac_sdn', 'OFAC Specially Designated Nationals List', 'US Department of the Treasury', 'https://ofac.treasury.gov', 1, 'geopolitical', 'active'),
  ('ucdp_ged', 'UCDP Georeferenced Event Dataset', 'Uppsala Conflict Data Program', 'https://ucdp.uu.se', 1, 'geopolitical', 'active')
on conflict (key) do nothing;

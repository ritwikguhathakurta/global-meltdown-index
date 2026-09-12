-- ============================================================================
-- IMF Primary Commodity Price System (PCPS) critical-mineral series
-- (Cobalt, Lithium, Manganese, Molybdenum, Vanadium Pentoxide, Rare Earth
-- Elements basket) — free, no key, no login. Mirrored via DBnomics
-- (db.nomics.world) since IMF's own API endpoints for this dataset are
-- dead (dataservices.imf.org does not resolve; api.imf.org/.../sdmx/3.0
-- returns 404). See src/lib/sources/dbnomicsCriticalMinerals.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('imf_pcps_dbnomics', 'IMF Primary Commodity Price System (via DBnomics)', 'International Monetary Fund', 'https://db.nomics.world/IMF/PCPS', 1, 'commodities', 'active')
on conflict (key) do nothing;

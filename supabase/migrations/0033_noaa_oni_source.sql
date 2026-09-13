-- ============================================================================
-- NOAA Oceanic Nino Index (ONI) for the Oilseeds sub-module's ENSO engine.
-- See src/lib/sources/noaaOni.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('noaa_oni', 'Oceanic Nino Index (ONI)', 'NOAA Climate Prediction Center', 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt', 1, 'commodities', 'active')
on conflict (key) do nothing;

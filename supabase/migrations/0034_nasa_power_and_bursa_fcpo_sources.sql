-- ============================================================================
-- NASA POWER regional rainfall for the Oilseeds sub-module.
-- See src/lib/sources/nasaPowerRainfall.ts.
--
-- Bursa Malaysia's FCPO derivatives-prices endpoint was also tested for
-- this pass (a real, public, no-login JSON endpoint was found) but proved
-- unusable: Cloudflare bot protection blocks Node's own fetch client
-- specifically, even though curl passes with an identical User-Agent. Since
-- this app's ingestion pipeline runs as a Node serverless function, that
-- endpoint is not wired in here (see the Oilseeds page/methodology page
-- disclosure for the full verification detail).
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('nasa_power', 'NASA POWER (Prediction Of Worldwide Energy Resources)', 'NASA Langley Research Center', 'https://power.larc.nasa.gov/docs/services/api/', 1, 'commodities', 'active')
on conflict (key) do nothing;

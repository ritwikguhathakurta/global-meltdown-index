-- ============================================================================
-- NOAA CPC's official ENSO probability forecast (forward-looking, updated
-- monthly) for the Oilseeds Rainfall Impact engine. See
-- src/lib/sources/cpcEnsoForecast.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('cpc_enso_forecast', 'CPC Official ENSO Probabilities', 'NOAA Climate Prediction Center', 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/', 1, 'commodities', 'active')
on conflict (key) do nothing;

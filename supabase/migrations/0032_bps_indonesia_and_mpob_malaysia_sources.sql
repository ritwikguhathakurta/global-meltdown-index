-- ============================================================================
-- Indonesia (BPS dynamic Web API, keyed) and Malaysia (MPOB legacy HTML
-- report, no API) oil palm / coconut data for the Oilseeds sub-module.
-- See src/lib/sources/bpsIndonesia.ts and src/lib/sources/mpobMalaysia.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('bps_indonesia', 'BPS Web API (Produksi Tanaman Perkebunan)', 'Badan Pusat Statistik (Statistics Indonesia)', 'https://webapi.bps.go.id/developer', 1, 'commodities', 'active'),
  ('mpob_malaysia', 'MPOB Monthly Export of Oil Palm Products', 'Malaysian Palm Oil Board', 'https://bepi.mpob.gov.my/stat/web_report1.php', 1, 'commodities', 'active')
on conflict (key) do nothing;

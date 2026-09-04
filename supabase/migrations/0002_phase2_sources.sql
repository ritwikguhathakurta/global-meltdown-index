-- ============================================================================
-- PHASE 2 SOURCE REGISTRY — engines 6-16 of the V3 24-engine spec
-- (Banking, Property/CRE, Global Sovereign Debt, Emerging-Market Debt,
--  Energy, China, Geopolitical, Derivatives/Leverage, Crypto/Stablecoins,
--  Cyber/Financial Infrastructure, Trade/Economic Policy, Supply Chains)
-- No schema changes needed — metric_series/risk_engine_scores are already
-- generic (see 0001_init.sql design note). This migration only registers the
-- new data providers so metric_series.source_id can resolve correctly.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('ny_fed_gscpi', 'Global Supply Chain Pressure Index', 'Federal Reserve Bank of New York', 'https://www.newyorkfed.org/research/gscpi.html', 1, 'supply_chain', 'active'),
  ('gpr_index', 'Geopolitical Risk Index', 'Caldara & Iacoviello (Federal Reserve Board economists, published independently)', 'https://www.matteoiacoviello.com/gpr.htm', 2, 'geopolitical', 'active'),
  ('coingecko', 'CoinGecko', 'CoinGecko', 'https://www.coingecko.com', 3, 'crypto', 'active'),
  ('aws_status', 'AWS Service Health Dashboard', 'Amazon Web Services', 'https://status.aws.amazon.com', 1, 'cyber', 'active'),
  ('azure_status', 'Azure Status History', 'Microsoft Azure', 'https://azure.status.microsoft', 1, 'cyber', 'active'),
  ('gcp_status', 'Google Cloud Status Dashboard', 'Google Cloud', 'https://status.cloud.google.com', 1, 'cyber', 'active')
on conflict (key) do nothing;

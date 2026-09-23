-- ============================================================================
-- New source connectors for the Derivatives & Leverage dashboard rebuild
-- (src/app/dashboard/derivatives). See docs/DERIVATIVES_ENGINE.md.
--
-- bis_otc_derivatives — BIS semiannual OTC derivatives statistics (notional
--   outstanding by risk category), Tier 1 official.
-- nyfed_repo — NY Fed Markets Data API (SOFR/TGCR/BGCR rates, percentile
--   dispersion, volume), Tier 1 official.
-- binance_perp — Binance Futures public API (BTC/ETH perpetual funding rate
--   and open interest), Tier 3 — a single commercial exchange, not a
--   regulator or cross-exchange aggregate.
--
-- cftc_cot (Disaggregated COT + Traders-in-Financial-Futures reports) reuses
-- the existing 'cftc_cot' source row already registered for the Legacy COT
-- report — same institution/tier, no new row needed.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('bis_otc_derivatives', 'BIS OTC Derivatives Statistics', 'Bank for International Settlements', 'https://stats.bis.org', 1, 'derivatives', 'active'),
  ('nyfed_repo', 'NY Fed Markets Data (Repo & Reference Rates)', 'Federal Reserve Bank of New York', 'https://markets.newyorkfed.org', 1, 'derivatives', 'active'),
  ('binance_perp', 'Binance Futures Public API', 'Binance', 'https://www.binance.com', 3, 'derivatives', 'active')
on conflict (key) do nothing;

-- ============================================================================
-- Per-central-bank AMPLE/ADEQUATE/NORMAL/TIGHTENING/DEFICIT liquidity
-- classification on the Global Liquidity tab, based on real money-market-
-- rate-vs-policy-rate spreads (SOFR-IORB, SONIA-Bank Rate, CORRA-Target,
-- €STR-Deposit Facility Rate) plus Fed reserve balances (WRESBAL) and
-- Japan's uncollateralized overnight call rate (BOJ's own new public API).
-- BoE and BoC reuse their existing 'boe'/'boc' source rows (same
-- institutions, additional series). See src/lib/sources/govBondYields.ts,
-- src/lib/engines/liquidityRegime.ts, src/lib/engines/globalLiquidity.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('ecb_sdw', 'ECB Data Portal (Euro short-term rate, €STR)', 'European Central Bank', 'https://data.ecb.europa.eu/', 1, 'liquidity', 'active'),
  ('boj_stats', 'BOJ Time-Series Data Search API (Uncollateralized O/N Call Rate)', 'Bank of Japan', 'https://www.stat-search.boj.or.jp/', 1, 'liquidity', 'active')
on conflict (key) do nothing;

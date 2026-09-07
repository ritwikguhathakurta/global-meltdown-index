-- ============================================================================
-- Japan's Ministry of Finance now provides a genuine daily direct source for
-- the JGB 10Y yield (yield.japan_10y), replacing the FRED/OECD monthly proxy
-- (IRLTLT01JPM156N, which structurally lagged 2-4 months). See
-- src/lib/sources/govBondYields.ts (fetchJapanYield10y) and treasury.ts /
-- yenCarry.ts for where it's consumed.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('mof_japan', 'JGB Interest Rate (daily CSV)', 'Ministry of Finance, Japan', 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/', 1, 'sovereign_yields', 'active')
on conflict (key) do nothing;

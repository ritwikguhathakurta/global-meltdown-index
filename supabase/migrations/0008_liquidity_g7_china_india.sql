-- ============================================================================
-- Global Liquidity extended to all of G7+China (UK/Canada added directly
-- from BoE/BoC; China reuses the existing 3M interbank rate). A new,
-- separate India Liquidity engine/tab added, sourced from RBI's own daily
-- "Money Market Operations" press release.
-- See src/lib/sources/govBondYields.ts, src/lib/sources/rbiLiquidity.ts,
-- src/lib/engines/globalLiquidity.ts, src/lib/engines/indiaLiquidity.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('rbi_liquidity', 'RBI Money Market Operations (daily press release)', 'Reserve Bank of India', 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx', 1, 'liquidity', 'active')
on conflict (key) do nothing;

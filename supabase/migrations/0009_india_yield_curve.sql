-- ============================================================================
-- New India Yield Curve engine/tab (short/medium/long sovereign curve shape
-- and inversion risk), built entirely from RBI's own T-Bill and G-Sec
-- primary-auction results. CCIL (the natural secondary-market source) was
-- evaluated and deliberately not used: its Terms of Use explicitly forbid
-- automated data collection (§4.8) and commercial use of its Content
-- without written consent (§4.1). RBI's Money Market Operations backfill
-- (India Liquidity engine) also extended for the Diwali/March seasonal
-- analysis (indiaSeasonality.ts) — no new source needed there, same
-- rbi_liquidity source key as before.
-- See src/lib/sources/rbiArchive.ts, src/lib/sources/rbiYieldCurve.ts,
-- src/lib/engines/indiaYieldCurve.ts, src/lib/engines/indiaSeasonality.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('rbi_gsec_auctions', 'RBI T-Bill & Government Stock Auction Results (primary market)', 'Reserve Bank of India', 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx', 1, 'sovereign_yields', 'active')
on conflict (key) do nothing;

-- ============================================================================
-- China's 10Y government bond yield (previously UNAVAILABLE — no free source
-- was known to exist) now comes from ChinaBond (CCDC), the PBOC-designated
-- central bond depository, via its "whole year" standard-tenor data export.
-- See src/lib/sources/chinaBondYield.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('chinabond', 'ChinaBond Government Bond Yield Curve', 'China Central Depository & Clearing Co. (CCDC)', 'https://yield.chinabond.com.cn', 1, 'sovereign_yields', 'active')
on conflict (key) do nothing;
